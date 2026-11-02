package com.tourney.player

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.ApiException
import com.tourney.core.model.DepositSubmitResponse
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.PlayerDepositsResponse
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.SubmitDepositRequest
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.User
import com.tourney.core.model.WalletSummary
import com.tourney.core.model.WithdrawRequest
import com.tourney.core.model.WithdrawResponse
import com.tourney.core.network.ApiClient
import com.tourney.core.network.DeviceIdProvider
import com.tourney.core.network.apiCall
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
    }

    private fun loadDiskCache() {
        runCatching {
            val feedJson = diskCache.getString("cached_feed", null)
            if (!feedJson.isNullOrBlank()) {
                val adapter = ApiClient.moshi.adapter(TournamentListResponse::class.java)
                val cached = adapter.fromJson(feedJson)
                if (cached != null && cached.items.isNotEmpty()) {
                    feedUi = UiState.Success(cached)
                }
            }
        }
        runCatching {
            val walletJson = diskCache.getString("cached_wallet", null)
            if (!walletJson.isNullOrBlank()) {
                val adapter = ApiClient.moshi.adapter(WalletSummary::class.java)
                val cached = adapter.fromJson(walletJson)
                if (cached != null) {
                    walletUi = UiState.Success(cached)
                }
            }
        }
    }

    private fun saveFeedCache(data: TournamentListResponse) {
        runCatching {
            val adapter = ApiClient.moshi.adapter(TournamentListResponse::class.java)
            diskCache.edit().putString("cached_feed", adapter.toJson(data)).apply()
        }
    }

    private fun saveWalletCache(data: WalletSummary) {
        runCatching {
            val adapter = ApiClient.moshi.adapter(WalletSummary::class.java)
            diskCache.edit().putString("cached_wallet", adapter.toJson(data)).apply()
        }
    }

    /** Reactive session — collected in MainActivity to pick login vs main UI. */
    val sessionFlow: Flow<SessionState> = session.session

    // ─── Auth ────────────────────────────────────────────────────────────
    var authUi by mutableStateOf<UiState<User>>(UiState.Idle)
        private set

    fun login(phoneNumber: String) {
        authUi = UiState.Loading
        viewModelScope.launch {
            try {
                val response = apiCall {
                    api.login(LoginRequest(tenantId = config.tenantId, phoneNumber = phoneNumber))
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

    fun register(phoneNumber: String, inGameName: String, inGameUid: String) {
        authUi = UiState.Loading
        viewModelScope.launch {
            try {
                val response = apiCall {
                    api.register(
                        RegisterRequest(
                            tenantId = config.tenantId,
                            phoneNumber = phoneNumber,
                            inGameName = inGameName,
                            inGameUid = inGameUid,
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

    private suspend fun persistLogin(response: com.tourney.core.model.AuthResponse) {
        session.saveSession(
            authToken = response.token,
            userId = response.user.id,
            tenantId = response.user.tenantId,
            role = response.user.role,
            permissions = response.user.permissions,
        )
    }

    fun logout() {
        feedUi = UiState.Idle
        walletUi = UiState.Idle
        authUi = UiState.Idle
        depositUi = UiState.Idle
        withdrawUi = UiState.Idle
        runCatching { diskCache.edit().clear().apply() }
        viewModelScope.launch { session.clearSession() }
    }

    // ─── Feed ────────────────────────────────────────────────────────────
    var feedUi by mutableStateOf<UiState<TournamentListResponse>>(UiState.Idle)
        private set

    fun refreshFeed(forceLoading: Boolean = false) {
        if (forceLoading || feedUi is UiState.Idle || feedUi is UiState.Error) {
            feedUi = UiState.Loading
        }
        viewModelScope.launch {
            try {
                val fresh = apiCall { api.listTournaments(status = null, limit = 25) }
                feedUi = UiState.Success(fresh)
                saveFeedCache(fresh)
            } catch (e: ApiException) {
                if (feedUi !is UiState.Success) feedUi = UiState.Error(e.message)
            } catch (e: Exception) {
                if (feedUi !is UiState.Success) feedUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    // ─── Wallet ──────────────────────────────────────────────────────────
    var walletUi by mutableStateOf<UiState<WalletSummary>>(UiState.Idle)
        private set

    fun refreshWallet(forceLoading: Boolean = false) {
        if (forceLoading || walletUi is UiState.Idle || walletUi is UiState.Error) {
            walletUi = UiState.Loading
        }
        viewModelScope.launch {
            try {
                val fresh = apiCall { api.wallet(limit = 30) }
                walletUi = UiState.Success(fresh)
                saveWalletCache(fresh)
            } catch (e: ApiException) {
                if (walletUi !is UiState.Success) walletUi = UiState.Error(e.message)
            } catch (e: Exception) {
                if (walletUi !is UiState.Success) walletUi = UiState.Error("Network error — is the server running?")
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
        refreshWallet(forceLoading = false)
    }

    /** Prefetch feed and wallet in background after login or app startup */
    fun prefetchData() {
        refreshFeed(forceLoading = false)
        refreshWallet(forceLoading = false)
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