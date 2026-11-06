package com.tourney.player

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.ApiException
import com.tourney.core.model.CreatePaymentOrderRequest
import com.tourney.core.model.DepositSubmitResponse
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.model.PaymentOrderStatus
import com.tourney.core.model.PaymentGatewayInfo
import com.tourney.core.model.VerifyPaymentRequest
import com.tourney.core.model.VerifyPaymentResponse
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.PlayerDepositsResponse
import com.tourney.core.model.PlayerStats
import com.tourney.core.model.TenantSettings
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.SendEmailOtpRequest
import com.tourney.core.model.VerifyEmailOtpRequest
import com.tourney.core.model.EmailOtpResponse
import com.tourney.core.model.SubmitDepositRequest
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.User
import com.tourney.core.model.WalletSummary
import com.tourney.core.model.WithdrawRequest
import com.tourney.core.model.WithdrawResponse
import com.tourney.core.model.TournamentStatus
import com.tourney.core.network.RealtimeEvent
import com.tourney.core.network.TourneyRealtimeClient
import com.tourney.core.payment.PaymentOrdersApi
import com.tourney.core.payment.TopUpController
import com.tourney.core.network.ApiClient
import com.tourney.core.network.DeviceIdProvider
import com.tourney.core.network.apiCall
import com.tourney.core.theme.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

/** UPI handle@bank validation (backend-regex parity). */
val UPI_ID_REGEX = Regex("^[a-zA-Z0-9.\\-_]{2,256}@[a-zA-Z]{2,64}$")

/** Simple UI state machine shared by all screens. */
sealed interface UiState<out T> {
    data object Idle : UiState<Nothing>
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

/**
 * Player app — auth (login/register), tournament feed, wallet.
 * The session lives in DataStore so the UI restores instantly on cold start.
 */
class PlayerViewModel(app: Application) : AndroidViewModel(app) {

    private val api get() = ApiClient.tourneyApi
    private val session get() = ApiClient.sessionManager
    val config get() = ApiClient.config
    private val diskCache = app.getSharedPreferences("tourney_local_cache", android.content.Context.MODE_PRIVATE)

    init {
        loadDiskCache()
        loadSettings()
        observeRealtimeEvents()
    }

    
    private fun observeRealtimeEvents() {
        viewModelScope.launch {
            TourneyRealtimeClient.events.collect { event ->
                when (event) {
                    is RealtimeEvent.SlotBooked -> {
                        val currentFeed = (feedUi as? UiState.Success)?.data ?: return@collect
                        val updatedItems = currentFeed.items.map { item ->
                            if (item.id == event.tournamentId) {
                                val newStatus = event.status?.let {
                                    runCatching { TournamentStatus.valueOf(it) }.getOrNull()
                                } ?: if (event.slotsBooked >= event.totalSlots) TournamentStatus.SLOTS_FULL else item.status
                                item.copy(
                                    slotsBooked = event.slotsBooked,
                                    totalSlots = event.totalSlots,
                                    status = newStatus
                                )
                            } else {
                                item
                            }
                        }
                        val updatedFeed = currentFeed.copy(items = updatedItems)
                        feedUi = UiState.Success(updatedFeed)
                        saveFeedCache(updatedFeed)
                    }

                    is RealtimeEvent.WalletUpdated -> {
                        val currentWallet = (walletUi as? UiState.Success)?.data
                        if (currentWallet != null) {
                            val updated = currentWallet.copy(
                                depositBalance = "%.2f".format(java.util.Locale.US, event.depositBalance),
                                winningBalance = "%.2f".format(java.util.Locale.US, event.winningBalance),
                                totalBalance = "%.2f".format(java.util.Locale.US, event.totalBalance),
                            )
                            walletUi = UiState.Success(updated)
                            saveWalletCache(updated)
                        } else {
                            refreshWallet(silent = true)
                        }
                    }

                    is RealtimeEvent.MatchStatusChanged -> {
                        val currentFeed = (feedUi as? UiState.Success)?.data ?: return@collect
                        if (event.status == TournamentStatus.COMPLETED || event.status == TournamentStatus.CANCELLED) {
                            val filtered = currentFeed.items.filter { it.id != event.tournamentId }
                            val updatedFeed = currentFeed.copy(items = filtered)
                            feedUi = UiState.Success(updatedFeed)
                            saveFeedCache(updatedFeed)
                        } else {
                            val updatedItems = currentFeed.items.map { item ->
                                if (item.id == event.tournamentId) {
                                    item.copy(status = event.status)
                                } else {
                                    item
                                }
                            }
                            val updatedFeed = currentFeed.copy(items = updatedItems)
                            feedUi = UiState.Success(updatedFeed)
                            saveFeedCache(updatedFeed)
                        }
                    }

                    is RealtimeEvent.RoomCredentialsRevealed -> {
                        refreshFeed(silent = true)
                    }

                    is RealtimeEvent.DepositApproved -> {
                        refreshWallet(silent = true)
                    }

                    is RealtimeEvent.PrizeWon -> {
                        refreshWallet(silent = true)
                    }
                }
            }
        }
    }

    private fun loadDiskCache() {
        runCatching {
            val feedJson = diskCache.getString("cached_feed", null)
            if (!feedJson.isNullOrBlank()) {
                val cached = ApiClient.fromJson(TournamentListResponse::class.java, feedJson)
                if (cached != null && cached.items.isNotEmpty()) {
                    feedUi = UiState.Success(cached)
                }
            }
        }
        runCatching {
            val walletJson = diskCache.getString("cached_wallet", null)
            if (!walletJson.isNullOrBlank()) {
                val cached = ApiClient.fromJson(WalletSummary::class.java, walletJson)
                if (cached != null) {
                    walletUi = UiState.Success(cached)
                }
            }
        }
    }

    private fun saveFeedCache(data: TournamentListResponse) {
        runCatching {
            val json = ApiClient.toJson(TournamentListResponse::class.java, data)
            diskCache.edit().putString("cached_feed", json).apply()
        }
    }

    private fun saveWalletCache(data: WalletSummary) {
        runCatching {
            val json = ApiClient.toJson(WalletSummary::class.java, data)
            diskCache.edit().putString("cached_wallet", json).apply()
        }
    }

    /** Reactive session — collected in MainActivity to pick login vs main UI. */
    val sessionFlow: Flow<SessionState> = session.session

    // ─── Auth ────────────────────────────────────────────────────────────
    var authUi by mutableStateOf<UiState<User>>(UiState.Idle)
        private set

    fun login(phoneNumber: String, idToken: String? = null) {
        authUi = UiState.Loading
        viewModelScope.launch {
            try {
                val response = apiCall {
                    api.login(
                        LoginRequest(
                            tenantId = config.tenantId,
                            phoneNumber = phoneNumber.takeIf { it.isNotBlank() },
                            idToken = idToken,
                        )
                    )
                }
                persistLogin(response)
                authUi = UiState.Success(response.user)
                prefetchData()
            } catch (e: ApiException) {
                authUi = UiState.Error(e.message)
            } catch (e: Exception) {
                authUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    fun loginWithGoogle(idToken: String, name: String? = null) {
        authUi = UiState.Loading
        viewModelScope.launch {
            try {
                val response = apiCall {
                    api.googleLogin(
                        com.tourney.core.model.GoogleAuthRequest(
                            tenantId = config.tenantId,
                            idToken = idToken,
                            deviceId = DeviceIdProvider.androidId(getApplication()),
                            name = name?.takeIf { it.isNotBlank() },
                        )
                    )
                }
                persistLogin(response)
                authUi = UiState.Success(response.user)
                prefetchData()
            } catch (e: ApiException) {
                authUi = UiState.Error(e.message)
            } catch (e: Exception) {
                authUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    fun register(
        phoneNumber: String,
        idToken: String? = null,
        name: String? = null,
        inGameName: String? = null,
        inGameUid: String? = null,
    ) {
        authUi = UiState.Loading
        viewModelScope.launch {
            try {
                val response = apiCall {
                    api.register(
                        RegisterRequest(
                            tenantId = config.tenantId,
                            phoneNumber = phoneNumber.takeIf { it.isNotBlank() },
                            idToken = idToken,
                            name = name?.takeIf { it.isNotBlank() },
                            inGameName = inGameName?.takeIf { it.isNotBlank() },
                            inGameUid = inGameUid?.takeIf { it.isNotBlank() },
                            deviceId = DeviceIdProvider.androidId(getApplication()),
                        )
                    )
                }
                persistLogin(response)
                authUi = UiState.Success(response.user)
                prefetchData()
            } catch (e: ApiException) {
                authUi = UiState.Error(e.message)
            } catch (e: Exception) {
                authUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    fun sendEmailOtp(
        email: String,
        password: String,
        name: String? = null,
        type: String = "REGISTER",
        onSuccess: (EmailOtpResponse) -> Unit,
        onError: (String) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val res = apiCall {
                    api.sendEmailOtp(
                        SendEmailOtpRequest(
                            tenantId = config.tenantId,
                            email = email.trim(),
                            password = password,
                            name = name?.trim()?.takeIf { it.isNotBlank() },
                            type = type,
                        )
                    )
                }
                onSuccess(res)
            } catch (e: ApiException) {
                onError(e.message)
            } catch (e: Exception) {
                onError("Network error — is the server running?")
            }
        }
    }

    fun verifyEmailOtp(
        email: String,
        code: String,
        password: String,
        name: String? = null,
        type: String = "REGISTER",
    ) {
        authUi = UiState.Loading
        viewModelScope.launch {
            try {
                val response = apiCall {
                    api.verifyEmailOtp(
                        VerifyEmailOtpRequest(
                            tenantId = config.tenantId,
                            email = email.trim(),
                            code = code.trim(),
                            password = password,
                            name = name?.trim()?.takeIf { it.isNotBlank() },
                            deviceId = DeviceIdProvider.androidId(getApplication()),
                            type = type,
                        )
                    )
                }
                persistLogin(response)
                authUi = UiState.Success(response.user)
                prefetchData()
            } catch (e: ApiException) {
                authUi = UiState.Error(e.message)
            } catch (e: Exception) {
                authUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    private suspend fun persistLogin(response: com.tourney.core.model.AuthResponse) {
        TourneyRealtimeClient.updateToken(response.token)
        session.saveSession(
            authToken = response.token,
            userId = response.user.id,
            tenantId = response.user.tenantId,
            role = response.user.role,
            permissions = response.user.permissions,
            inGameName = response.user.inGameName,
            inGameUid = response.user.inGameUid,
        )
    }

    fun logout() {
        TourneyRealtimeClient.updateToken(null)
        feedUi = UiState.Idle
        walletUi = UiState.Idle
        authUi = UiState.Idle
        depositUi = UiState.Idle
        withdrawUi = UiState.Idle
        completedUi = UiState.Idle
        meUi = UiState.Idle
        statsUi = UiState.Idle
        settingsUi = UiState.Idle
        runCatching { diskCache.edit().clear().apply() }
        viewModelScope.launch { session.clearSession() }
    }

    // ─── Appearance (Boss demand: light + dark mode) ─────────────────────
    /** Reactive appearance preference (persisted in DataStore). */
    val themeModeFlow: Flow<ThemeMode> = session.themeMode

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { session.saveThemeMode(mode) }
    }

    // ─── Runtime tenant settings (UPI / WhatsApp / min deposit) ──────────
    /**
     * Live settings owned by the client. The deposit QR, payee name, minimum
     * amount and support link read from here, so an owner can rotate their UPI
     * ID from the Admin app without a new APK.
     */
    var settingsUi by mutableStateOf<UiState<TenantSettings>>(UiState.Idle)
        private set

    /** Best-known settings: backend value first, bundled config as fallback. */
    val liveSettings: TenantSettings
        get() = (settingsUi as? UiState.Success)?.data ?: TenantSettings(
            brandName = config.clientName,
            upiId = config.upiId,
            upiName = config.upiName,
            supportWhatsapp = config.supportWhatsapp,
            minDeposit = config.minDeposit,
        )

    fun loadSettings() {
        viewModelScope.launch {
            settingsUi = try {
                UiState.Success(apiCall { api.tenantSettings(tenantId = config.tenantId) })
            } catch (e: ApiException) {
                UiState.Error(e.message)
            } catch (e: Exception) {
                UiState.Error("Could not load app settings")
            }
        }
    }

    // ─── Profile (identity card + career stats) ──────────────────────────
    var meUi by mutableStateOf<UiState<User>>(UiState.Idle)
        private set

    var statsUi by mutableStateOf<UiState<PlayerStats>>(UiState.Idle)
        private set

    var isProfileRefreshing by mutableStateOf(false)
        private set

    fun loadProfile() {
        isProfileRefreshing = true
        viewModelScope.launch {
            try {
                meUi = try {
                    UiState.Success(apiCall { api.me() })
                } catch (e: ApiException) {
                    UiState.Error(e.message)
                } catch (e: Exception) {
                    UiState.Error("Could not load your profile")
                }
                statsUi = try {
                    UiState.Success(apiCall { api.playerStats() })
                } catch (e: ApiException) {
                    UiState.Error(e.message)
                } catch (e: Exception) {
                    UiState.Error("Could not load your stats")
                }
                loadSettings()
            } finally {
                isProfileRefreshing = false
            }
        }
    }

    var isUpdatingProfile by mutableStateOf(false)
        private set

    fun updateGameProfile(
        inGameName: String,
        inGameUid: String,
        onResult: (Boolean, String?) -> Unit = { _, _ -> },
    ) {
        isUpdatingProfile = true
        viewModelScope.launch {
            try {
                val updated = apiCall {
                    api.updateGameProfile(
                        com.tourney.core.model.UpdateGameProfileRequest(
                            inGameName = inGameName.trim(),
                            inGameUid = inGameUid.trim(),
                        )
                    )
                }
                session.saveGameProfile(inGameName.trim(), inGameUid.trim())
                meUi = UiState.Success(updated)
                isUpdatingProfile = false
                onResult(true, null)
            } catch (e: ApiException) {
                isUpdatingProfile = false
                onResult(false, e.message)
            } catch (e: Exception) {
                isUpdatingProfile = false
                onResult(false, "Could not update profile — check your network")
            }
        }
    }

    // ─── Feed ────────────────────────────────────────────────────────────
    var feedUi by mutableStateOf<UiState<TournamentListResponse>>(UiState.Idle)
        private set

    var isFeedRefreshing by mutableStateOf(false)
        private set

    fun refreshFeed(forceLoading: Boolean = false, silent: Boolean = false) {
        if (!silent && (forceLoading || feedUi is UiState.Idle || feedUi is UiState.Error)) {
            feedUi = UiState.Loading
        }
        if (!silent) isFeedRefreshing = true
        viewModelScope.launch {
            try {
                val fresh = apiCall { api.listTournaments(status = null, limit = 50) }
                feedUi = UiState.Success(fresh)
                saveFeedCache(fresh)
            } catch (e: ApiException) {
                if (feedUi !is UiState.Success) feedUi = UiState.Error(e.message)
            } catch (e: Exception) {
                if (feedUi !is UiState.Success) feedUi = UiState.Error("Network error — is the server running?")
            } finally {
                if (!silent) isFeedRefreshing = false
            }
        }
    }

    // ─── Completed history (past scoreboards stay browsable) ─────────────
    var completedUi by mutableStateOf<UiState<TournamentListResponse>>(UiState.Idle)
        private set

    var isCompletedRefreshing by mutableStateOf(false)
        private set

    fun refreshCompleted(forceLoading: Boolean = false) {
        if (forceLoading || completedUi is UiState.Idle || completedUi is UiState.Error) {
            completedUi = UiState.Loading
        }
        isCompletedRefreshing = true
        viewModelScope.launch {
            try {
                val fresh = apiCall { api.listTournaments(status = "COMPLETED", limit = 25) }
                completedUi = UiState.Success(fresh)
            } catch (e: ApiException) {
                if (completedUi !is UiState.Success) completedUi = UiState.Error(e.message)
            } catch (e: Exception) {
                if (completedUi !is UiState.Success) completedUi = UiState.Error("Network error — is the server running?")
            } finally {
                isCompletedRefreshing = false
            }
        }
    }

    // ─── Wallet ──────────────────────────────────────────────────────────
    var walletUi by mutableStateOf<UiState<WalletSummary>>(UiState.Idle)
        private set

    var isWalletRefreshing by mutableStateOf(false)
        private set

    fun refreshWallet(forceLoading: Boolean = false, silent: Boolean = false) {
        if (!silent && (forceLoading || walletUi is UiState.Idle || walletUi is UiState.Error)) {
            walletUi = UiState.Loading
        }
        if (!silent) isWalletRefreshing = true
        viewModelScope.launch {
            try {
                val fresh = apiCall { api.wallet(limit = 30) }
                walletUi = UiState.Success(fresh)
                saveWalletCache(fresh)
            } catch (e: ApiException) {
                if (walletUi !is UiState.Success) walletUi = UiState.Error(e.message)
            } catch (e: Exception) {
                if (walletUi !is UiState.Success) walletUi = UiState.Error("Network error — is the server running?")
            } finally {
                if (!silent) isWalletRefreshing = false
            }
        }
    }

    /** Optimistic wallet deduction on match join — 0ms instant local update */
    fun deductEntryFee(fee: Double) {
        val current = (walletUi as? UiState.Success)?.data ?: return
        val currentDeposit = current.depositValue
        val currentWinning = current.winningValue
        val newDeposit: Double
        val newWinning: Double
        if (currentDeposit >= fee) {
            newDeposit = currentDeposit - fee
            newWinning = currentWinning
        } else {
            newDeposit = 0.0
            newWinning = (currentWinning - (fee - currentDeposit)).coerceAtLeast(0.0)
        }
        walletUi = UiState.Success(
            current.copy(
                depositBalance = "%.2f".format(java.util.Locale.US, newDeposit),
                winningBalance = "%.2f".format(java.util.Locale.US, newWinning),
            )
        )
        refreshWallet(silent = true)
    }

    // ─── Online wallet top-up (payment gateway) ──────────────────────────
    // The state machine lives in core (`TopUpController`) so it is unit-tested
    // without Android; this class only wires it to Retrofit + the wallet refresh.
    private val topUpController = TopUpController(
        scope = viewModelScope,
        orders = object : PaymentOrdersApi {
            override suspend fun createOrder(amountPaise: Int): PaymentOrderCreated =
                apiCall { api.createPaymentOrder(CreatePaymentOrderRequest(amountPaise)) }

            override suspend fun verify(request: VerifyPaymentRequest): VerifyPaymentResponse =
                apiCall { api.verifyPayment(request) }

            override suspend fun order(orderId: String): PaymentOrderStatus =
                apiCall { api.paymentOrder(orderId) }

            override suspend fun sync(orderId: String): VerifyPaymentResponse =
                apiCall { api.syncPaymentOrder(orderId) }

            override suspend fun gatewayInfo(): PaymentGatewayInfo =
                apiCall { api.paymentGatewayInfo() }
        },
        onSettled = { _ ->
            refreshWallet(silent = true)
            loadMyDeposits()
        },
    )

    /** Last created top-up order — survives the checkout round-trip. */
    val activeTopUp: PaymentOrderCreated? get() = topUpController.activeOrder

    /** Inline status line shown inside the Add Money sheet. */
    val topUpMessage: String? get() = topUpController.message

    /** True while creating / verifying / reconciling an order. */
    val topUpBusy: Boolean get() = topUpController.isBusy

    /** True once the money is confirmed in the wallet. */
    val topUpSettled: Boolean get() = topUpController.isSettled

    /** Public gateway info (provider + limits + demo flag). */
    val gatewayInfo: PaymentGatewayInfo? get() = topUpController.gatewayInfo

    fun loadGatewayInfo() = topUpController.loadGatewayInfo()

    fun clearTopUp() = topUpController.clear()

    fun createTopUp(amountRupees: Int, onReady: (PaymentOrderCreated) -> Unit) =
        topUpController.start(amountRupees, onReady)

    fun onGatewayPaymentSuccess(paymentId: String, signature: String?) =
        topUpController.onGatewaySuccess(paymentId, signature)

    fun onGatewayPaymentError(reason: String?) = topUpController.onGatewayError(reason)

    fun syncTopUp() = topUpController.sync()

    // ─── Direct Match Joining (from Feed Bottom Sheet) ────────────────────
    var isJoiningMatch by mutableStateOf(false)
        private set
    var joinMatchError by mutableStateOf<String?>(null)
        private set

    fun joinMatch(
        tournamentId: String,
        inGameName: String,
        inGameUid: String,
        teamCode: String? = null,
        onSuccess: (com.tourney.core.model.JoinResult) -> Unit,
    ) {
        if (isJoiningMatch) return
        isJoiningMatch = true
        joinMatchError = null

        viewModelScope.launch {
            try {
                val result = apiCall {
                    api.joinTournament(
                        tournamentId,
                        com.tourney.core.model.JoinRequest(
                            slotNumber = null,
                            teamCode = teamCode?.takeIf { it.isNotBlank() },
                            inGameName = inGameName.trim(),
                            inGameUid = inGameUid.trim(),
                            saveAsDefault = true,
                        ),
                    )
                }
                session.saveGameProfile(inGameName.trim(), inGameUid.trim())
                val feeDouble = result.entryFee.toDoubleOrNull() ?: 0.0
                deductEntryFee(feeDouble)
                refreshFeed(forceLoading = false)
                refreshWallet(forceLoading = false)
                onSuccess(result)
            } catch (e: ApiException) {
                joinMatchError = e.message
            } catch (e: Exception) {
                joinMatchError = e.message ?: "Failed to join tournament"
            } finally {
                isJoiningMatch = false
            }
        }
    }

    fun clearJoinError() {
        joinMatchError = null
    }

    /** Prefetch feed and wallet in background after login or app startup */
    fun prefetchData() {
        refreshFeed(forceLoading = false)
        refreshWallet(forceLoading = false)
        loadProfile()   // also refreshes tenant settings
    }

    // ─── Deposit / Add Cash (UPI transfer + UTR proof, admin verified) ───
    var depositUi by mutableStateOf<UiState<DepositSubmitResponse>>(UiState.Idle)
        private set

    /** Own deposit history — status chips inside the Add Cash modal. */
    var myDepositsUi by mutableStateOf<UiState<PlayerDepositsResponse>>(UiState.Idle)
        private set

    fun loadMyDeposits() {
        if (myDepositsUi is UiState.Loading) return
        myDepositsUi = UiState.Loading
        viewModelScope.launch {
            myDepositsUi = try {
                UiState.Success(apiCall { api.myDeposits(limit = 10) })
            } catch (e: ApiException) {
                UiState.Error(e.message)
            } catch (e: Exception) {
                UiState.Error("Network error — is the server running?")
            }
        }
    }

    /**
     * Submit an Add Cash request. No balance is credited here — the player
     * pays the client's UPI ID first, then staff verify the UTR.
     */
    fun submitDeposit(amount: Double, utrNumber: String) {
        if (depositUi is UiState.Loading) return
        depositUi = UiState.Loading
        viewModelScope.launch {
            try {
                val res = apiCall {
                    api.submitDeposit(
                        SubmitDepositRequest(
                            amount = amount,
                            utrNumber = utrNumber.trim().uppercase(),
                        )
                    )
                }
                depositUi = UiState.Success(res)
                loadMyDeposits()
            } catch (e: ApiException) {
                depositUi = UiState.Error(e.message)
            } catch (e: Exception) {
                depositUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    fun clearDeposit() {
        depositUi = UiState.Idle
    }

    // ─── Withdrawal (winning balance -> UPI, anti-fraud deviceId) ────────
    var withdrawUi by mutableStateOf<UiState<WithdrawResponse>>(UiState.Idle)
        private set

    fun withdraw(upiId: String, amount: Double) {
        val prev = walletUi
        val current = (walletUi as? UiState.Success)?.data
        if (current != null && current.winningValue >= amount) {
            val optimistic = current.copy(
                winningBalance = (current.winningValue - amount).toString(),
            )
            walletUi = UiState.Success(optimistic)
        }
        withdrawUi = UiState.Loading
        viewModelScope.launch {
            try {
                val res = apiCall {
                    api.withdraw(
                        WithdrawRequest(
                            amount = amount,
                            upiId = upiId.trim(),
                            deviceId = DeviceIdProvider.androidId(getApplication()),
                        )
                    )
                }
                withdrawUi = UiState.Success(res)
                refreshWallet(forceLoading = false)
            } catch (e: ApiException) {
                walletUi = prev
                withdrawUi = UiState.Error(e.message)
            } catch (e: Exception) {
                walletUi = prev
                withdrawUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    fun clearWithdraw() {
        withdrawUi = UiState.Idle
    }
}