package com.tourney.admin

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.ApiException
import com.tourney.core.model.ApproveWithdrawalRequest
import com.tourney.core.model.CreateTournamentRequest
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.PayoutRequest
import com.tourney.core.model.PayoutResponse
import com.tourney.core.model.PayoutResultInput
import com.tourney.core.model.PublishRoomRequest
import com.tourney.core.model.RejectWithdrawalRequest
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.SlotsResponse
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.User
import com.tourney.core.model.WithdrawalsResponse
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

/** Admin UI state machine (same shape as the player's, kept local to this app). */
sealed interface AdminUi<out T> {
    data object Idle : AdminUi<Nothing>
    data object Loading : AdminUi<Nothing>
    data class Success<T>(val data: T) : AdminUi<T>
    data class Error(val message: String) : AdminUi<Nothing>
}

/**
 * Owner & staff console — phone auth, tournament management, room publishing
 * and the 1-click Spectator payout engine.
 */
class AdminViewModel(app: Application) : AndroidViewModel(app) {

    private val api get() = ApiClient.tourneyApi
    private val session get() = ApiClient.sessionManager
    private val config get() = ApiClient.config

    val sessionFlow: Flow<SessionState> = session.session

    // ─── Auth ────────────────────────────────────────────────────────────
    var authUi by mutableStateOf<AdminUi<User>>(AdminUi.Idle)
        private set

    fun login(phoneNumber: String) {
        authUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                val response = apiCall {
                    api.login(LoginRequest(tenantId = config.tenantId, phoneNumber = phoneNumber))
                }
                session.saveSession(
                    authToken = response.token,
                    userId = response.user.id,
                    tenantId = response.user.tenantId,
                    role = response.user.role,
                    permissions = response.user.permissions,
                )
                authUi = AdminUi.Success(response.user)
            } catch (e: ApiException) {
                authUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                authUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    fun logout() {
        viewModelScope.launch { session.clearSession() }
    }

    // ─── Tournament list (selector for publish / scorer) ─────────────────
    var tournamentsUi by mutableStateOf<AdminUi<TournamentListResponse>>(AdminUi.Idle)
        private set

    fun loadTournaments() {
        tournamentsUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                tournamentsUi = AdminUi.Success(apiCall { api.listTournaments(status = null, limit = 50) })
            } catch (e: ApiException) {
                tournamentsUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                tournamentsUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    // ─── Create match (canCreateMatch) ───────────────────────────────────
    var createUi by mutableStateOf<AdminUi<Tournament>>(AdminUi.Idle)
        private set

    fun createTournament(request: CreateTournamentRequest) {
        createUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                createUi = AdminUi.Success(apiCall { api.createTournament(request) })
            } catch (e: ApiException) {
                createUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                createUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    // ─── Publish room (canUpdateRoomId) ──────────────────────────────────
    var publishUi by mutableStateOf<AdminUi<RoomCredentials>>(AdminUi.Idle)
        private set

    fun publishRoom(tournamentId: String, roomId: String, roomPassword: String) {
        publishUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                publishUi = AdminUi.Success(
                    apiCall {
                        api.publishRoom(tournamentId, PublishRoomRequest(roomId, roomPassword))
                    }
                )
            } catch (e: ApiException) {
                publishUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                publishUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    // ─── Spectator scorer (canDistributePrize) ───────────────────────────
    var scorerSlotsUi by mutableStateOf<AdminUi<SlotsResponse>>(AdminUi.Idle)
        private set

    /** Participants of the selected tournament, in slot order. */
    var scorerParticipants by mutableStateOf<List<ScorerPlayer>>(emptyList())
        private set

    var payoutUi by mutableStateOf<AdminUi<PayoutResponse>>(AdminUi.Idle)
        private set

    var payoutRunning by mutableStateOf(false)
        private set

    fun loadScorerSlots(tournamentId: String) {
        scorerSlotsUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                val slots = apiCall { api.tournamentSlots(tournamentId) }
                scorerSlotsUi = AdminUi.Success(slots)
                scorerParticipants = slots.slots
                    .sortedBy { it.slotNumber }
                    .mapIndexed { index, slot ->
                        ScorerPlayer(
                            userId = slot.player?.id ?: "",
                            slotNumber = slot.slotNumber,
                            inGameName = slot.player?.inGameName ?: "Unknown",
                            inGameUid = slot.player?.inGameUid ?: "-",
                            verifiedKills = 0,
                            rank = index + 1,
                            disqualified = false,
                        )
                    }
            } catch (e: ApiException) {
                scorerSlotsUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                scorerSlotsUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    fun updateKills(userId: String, delta: Int) {
        val idx = scorerParticipants.indexOfFirst { it.userId == userId }
        if (idx >= 0) {
            val current = scorerParticipants[idx]
            scorerParticipants = scorerParticipants.toMutableList().apply {
                this[idx] = current.copy(verifiedKills = (current.verifiedKills + delta).coerceIn(0, 99))
            }
        }
    }

    fun updateRank(userId: String, rank: Int) {
        val idx = scorerParticipants.indexOfFirst { it.userId == userId }
        if (idx >= 0) {
            val current = scorerParticipants[idx]
            scorerParticipants = scorerParticipants.toMutableList().apply {
                this[idx] = current.copy(rank = rank.coerceIn(1, 999))
            }
        }
    }

    fun toggleDisqualify(userId: String) {
        val idx = scorerParticipants.indexOfFirst { it.userId == userId }
        if (idx >= 0) {
            val current = scorerParticipants[idx]
            scorerParticipants = scorerParticipants.toMutableList().apply {
                this[idx] = current.copy(disqualified = !current.disqualified)
            }
        }
    }

    /** 1-click payout — only ranked or disqualified players are submitted. */
    fun runPayout(tournamentId: String) {
        if (payoutRunning) return
        payoutRunning = true
        viewModelScope.launch {
            try {
                val results = scorerParticipants
                    .filter { it.userId.isNotBlank() }
                    .map { player ->
                        PayoutResultInput(
                            userId = player.userId,
                            verifiedKills = if (player.disqualified) 0 else player.verifiedKills,
                            rank = player.rank,
                            isDisqualified = player.disqualified,
                            disqualifyReason = if (player.disqualified) "Disqualified by spectator" else null,
                        )
                    }
                payoutUi = AdminUi.Success(
                    apiCall { api.payout(tournamentId, PayoutRequest(results)) }
                )
            } catch (e: ApiException) {
                payoutUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                payoutUi = AdminUi.Error("Network error — is the server running?")
            } finally {
                payoutRunning = false
                loadTournaments()
            }
        }
    }

    // ─── Withdrawal approvals (canManageWallet) ──────────────────────────
    var withdrawalsUi by mutableStateOf<AdminUi<WithdrawalsResponse>>(AdminUi.Idle)
        private set

    var walletBusy by mutableStateOf(false)
        private set

    var walletMessage by mutableStateOf<String?>(null)
        private set

    var walletError by mutableStateOf<String?>(null)
        private set

    fun loadWithdrawals(status: String? = "PENDING") {
        withdrawalsUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                withdrawalsUi = AdminUi.Success(apiCall { api.adminWithdrawals(status = status) })
            } catch (e: ApiException) {
                withdrawalsUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                withdrawalsUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    fun approveWithdrawal(id: String, utrNumber: String) {
        if (walletBusy) return
        walletBusy = true
        walletMessage = null
        walletError = null
        viewModelScope.launch {
            try {
                apiCall { api.approveWithdrawal(id, ApproveWithdrawalRequest(utrNumber)) }
                walletMessage = "Withdrawal approved ✓"
                loadWithdrawals("PENDING")
            } catch (e: ApiException) {
                walletError = e.message
            } catch (e: Exception) {
                walletError = "Network error — is the server running?"
            } finally {
                walletBusy = false
            }
        }
    }

    fun rejectWithdrawal(id: String, reason: String) {
        if (walletBusy) return
        walletBusy = true
        walletMessage = null
        walletError = null
        viewModelScope.launch {
            try {
                apiCall { api.rejectWithdrawal(id, RejectWithdrawalRequest(reason)) }
                walletMessage = "Withdrawal rejected & refunded ✓"
                loadWithdrawals("PENDING")
            } catch (e: ApiException) {
                walletError = e.message
            } catch (e: Exception) {
                walletError = "Network error — is the server running?"
            } finally {
                walletBusy = false
            }
        }
    }

    fun clearWalletFeedback() {
        walletMessage = null
        walletError = null
    }
}

/** One editable row in the spectator scorer console. */
data class ScorerPlayer(
    val userId: String,
    val slotNumber: Int,
    val inGameName: String,
    val inGameUid: String,
    val verifiedKills: Int,
    val rank: Int,
    val disqualified: Boolean,
)