package com.tourney.core.network

import android.util.Log
import com.tourney.core.model.TournamentStatus
import com.tourney.core.util.TimeAuthority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

sealed interface RealtimeEvent {
    data class SlotBooked(
        val tournamentId: String,
        val slotsBooked: Int,
        val totalSlots: Int,
        val fillFraction: Float,
        val status: String? = null,
    ) : RealtimeEvent

    data class WalletUpdated(
        val userId: String,
        val depositBalance: Double,
        val winningBalance: Double,
        val totalBalance: Double,
    ) : RealtimeEvent

    data class MatchStatusChanged(
        val tournamentId: String,
        val status: TournamentStatus,
        val roomRevealedAt: String? = null,
    ) : RealtimeEvent

    data class RoomCredentialsRevealed(
        val tournamentId: String,
        val roomId: String,
        val roomPassword: String,
        val roomRevealedAt: String? = null,
    ) : RealtimeEvent

    data class DepositApproved(
        val depositId: String,
        val amount: Double,
        val utrNumber: String,
        val depositBalance: Double,
    ) : RealtimeEvent

    data class PrizeWon(
        val tournamentId: String,
        val totalPrize: Double,
        val rank: Int?,
        val verifiedKills: Int?,
    ) : RealtimeEvent

    /**
     * The match feed itself changed (a match was created, cloned, made visible or
     * cancelled). The payload is intentionally thin — the client re-fetches the
     * list so visibility windows and ordering stay server-authoritative.
     */
    data class FeedChanged(
        val tournamentId: String?,
        val reason: String?,
    ) : RealtimeEvent
}

/**
 * ⚡ Real-Time Reactive WebSocket Gateway Client
 * Provides 0.05-second real-time streaming updates for:
 * - Live slot counters & progress bars
 * - Live wallet balances (deposit + winnings)
 * - Match state transitions (UPCOMING -> ROOM_REVEALED -> LIVE -> COMPLETED)
 * - Immediate custom room ID & password delivery to confirmed participants
 */
object TourneyRealtimeClient {
    private const val TAG = "TourneyRealtime"

    private val _events = MutableSharedFlow<RealtimeEvent>(replay = 0, extraBufferCapacity = 128)
    val events: SharedFlow<RealtimeEvent> = _events.asSharedFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var webSocket: WebSocket? = null
    private val isConnecting = AtomicBoolean(false)
    private val isConnected = AtomicBoolean(false)
    private var reconnectAttempts = 0

    /**
     * Configured by [init] from `ClientConfig.apiBaseUrl`. Deliberately blank by
     * default: a hardcoded localhost here made realtime fail silently on real
     * devices (PRODUCTION_CLOUD_EXECUTION_PLAN V2-E).
     */
    private var baseUrl: String = ""
    private var tenantId: String = ""
    private var tokenProvider: (() -> String?)? = null

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .pingInterval(25, TimeUnit.SECONDS)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS) // No read timeout for WebSocket
            .build()
    }

    fun init(baseUrl: String, tenantId: String, tokenProvider: () -> String?) {
        this.baseUrl = baseUrl
        this.tenantId = tenantId
        this.tokenProvider = tokenProvider
    }

    fun connect() {
        if (isConnected.get() || isConnecting.get()) return
        isConnecting.set(true)

        scope.launch {
            try {
                val wsUrl = RealtimeUrl.build(baseUrl, tenantId, tokenProvider?.invoke())
                if (wsUrl == null) {
                    // No usable base URL (e.g. release built without -PapiBaseUrl).
                    // Stay quiet instead of retrying a connection to nowhere.
                    Log.e(TAG, "Realtime disabled: no valid API base URL configured")
                    isConnecting.set(false)
                    return@launch
                }
                Log.d(TAG, "Connecting to WebSocket: $wsUrl")

                val request = Request.Builder()
                    .url(wsUrl)
                    .build()

                webSocket = okHttpClient.newWebSocket(request, createListener())
            } catch (e: Exception) {
                Log.e(TAG, "Error initiating WebSocket connection: ${e.message}")
                isConnecting.set(false)
                scheduleReconnect()
            }
        }
    }

    fun updateToken(token: String?) {
        if (!token.isNullOrBlank() && isConnected.get()) {
            val authMsg = JSONObject().apply {
                put("type", "AUTH")
                put("token", token)
            }.toString()
            webSocket?.send(authMsg)
        }
    }

    fun disconnect() {
        isConnected.set(false)
        isConnecting.set(false)
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
    }

    private fun scheduleReconnect() {
        if (isConnected.get()) return
        scope.launch {
            val delaySeconds = (1 shl reconnectAttempts.coerceAtMost(4)).coerceAtLeast(1)
            reconnectAttempts++
            Log.d(TAG, "Reconnecting in ${delaySeconds}s (attempt #$reconnectAttempts)...")
            delay(delaySeconds * 1000L)
            isConnecting.set(false)
            connect()
        }
    }

    private fun createListener(): WebSocketListener {
        return object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.i(TAG, "⚡ WebSocket connected successfully")
                isConnected.set(true)
                isConnecting.set(false)
                reconnectAttempts = 0

                // Request instant server time sync
                ws.send(JSONObject().apply { put("type", "PING") }.toString())

                // If authenticated, send token handshake
                val token = tokenProvider?.invoke()
                if (!token.isNullOrBlank()) {
                    val authMsg = JSONObject().apply {
                        put("type", "AUTH")
                        put("token", token)
                    }.toString()
                    ws.send(authMsg)
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type")
                    val data = json.optJSONObject("data") ?: JSONObject()

                    // Authoritative server-clock sync (anti clock spoofing)
                    val serverTimeMs = if (json.has("serverTimeMs")) {
                        json.optLong("serverTimeMs", 0L)
                    } else {
                        data.optLong("serverTimeMs", 0L)
                    }
                    if (serverTimeMs > 0L) {
                        TimeAuthority.sync(serverTimeMs, source = "WebSocket [$type]")
                    }

                    when (type) {
                        "CONNECTED" -> {
                            Log.d(TAG, "Handshake ack received from server")
                        }
                        "PONG" -> {
                            Log.d(TAG, "Server heartbeat PONG received with server time sync")
                        }
                        "SLOT_BOOKED" -> {
                            val event = RealtimeEvent.SlotBooked(
                                tournamentId = data.optString("tournamentId"),
                                slotsBooked = data.optInt("slotsBooked"),
                                totalSlots = data.optInt("totalSlots", 48),
                                fillFraction = data.optDouble("fillFraction", 0.0).toFloat(),
                                status = data.optString("status").takeIf { it.isNotBlank() }
                            )
                            _events.tryEmit(event)
                        }
                        "WALLET_UPDATED" -> {
                            val event = RealtimeEvent.WalletUpdated(
                                userId = data.optString("userId"),
                                depositBalance = data.optDouble("depositBalance", 0.0),
                                winningBalance = data.optDouble("winningBalance", 0.0),
                                totalBalance = data.optDouble("totalBalance", 0.0)
                            )
                            _events.tryEmit(event)
                        }
                        "MATCH_CREATED" -> {
                            val event = RealtimeEvent.FeedChanged(
                                tournamentId = data.optString("tournamentId").takeIf { it.isNotBlank() },
                                reason = data.optString("reason").takeIf { it.isNotBlank() },
                            )
                            _events.tryEmit(event)
                        }
                        "MATCH_STATUS_CHANGED" -> {
                            val rawStatus = data.optString("status")
                            val statusEnum = runCatching { TournamentStatus.valueOf(rawStatus) }.getOrNull()
                            if (statusEnum != null) {
                                val event = RealtimeEvent.MatchStatusChanged(
                                    tournamentId = data.optString("tournamentId"),
                                    status = statusEnum,
                                    roomRevealedAt = data.optString("roomRevealedAt").takeIf { it.isNotBlank() }
                                )
                                _events.tryEmit(event)
                            }
                        }
                        "ROOM_CREDENTIALS_REVEALED" -> {
                            val event = RealtimeEvent.RoomCredentialsRevealed(
                                tournamentId = data.optString("tournamentId"),
                                roomId = data.optString("roomId"),
                                roomPassword = data.optString("roomPassword"),
                                roomRevealedAt = data.optString("roomRevealedAt").takeIf { it.isNotBlank() }
                            )
                            _events.tryEmit(event)
                        }
                        "DEPOSIT_APPROVED" -> {
                            val event = RealtimeEvent.DepositApproved(
                                depositId = data.optString("depositId"),
                                amount = data.optDouble("amount", 0.0),
                                utrNumber = data.optString("utrNumber"),
                                depositBalance = data.optDouble("depositBalance", 0.0)
                            )
                            _events.tryEmit(event)
                        }
                        "PRIZE_WON" -> {
                            val event = RealtimeEvent.PrizeWon(
                                tournamentId = data.optString("tournamentId"),
                                totalPrize = data.optDouble("totalPrize", 0.0),
                                rank = if (data.has("rank")) data.optInt("rank") else null,
                                verifiedKills = if (data.has("verifiedKills")) data.optInt("verifiedKills") else null
                            )
                            _events.tryEmit(event)
                        }
                        else -> {
                            Log.d(TAG, "Unhandled realtime event type: $type")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse realtime message: ${e.message}")
                }
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closing: $code / $reason")
                isConnected.set(false)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $code / $reason")
                isConnected.set(false)
                isConnecting.set(false)
                scheduleReconnect()
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "WebSocket failure: ${t.message}")
                isConnected.set(false)
                isConnecting.set(false)
                scheduleReconnect()
            }
        }
    }
}
