package com.tourney.player

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.ApiException
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.User
import com.tourney.core.model.WalletSummary
import com.tourney.core.network.ApiClient
import com.tourney.core.network.DeviceIdProvider
import com.tourney.core.network.apiCall
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

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
    private val config get() = ApiClient.config

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
        viewModelScope.launch { session.clearSession() }
    }

    // ─── Feed ────────────────────────────────────────────────────────────
    var feedUi by mutableStateOf<UiState<TournamentListResponse>>(UiState.Idle)
        private set

    fun refreshFeed() {
        feedUi = UiState.Loading
        viewModelScope.launch {
            try {
                feedUi = UiState.Success(apiCall { api.listTournaments(status = null, limit = 25) })
            } catch (e: ApiException) {
                feedUi = UiState.Error(e.message)
            } catch (e: Exception) {
                feedUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    // ─── Wallet ──────────────────────────────────────────────────────────
    var walletUi by mutableStateOf<UiState<WalletSummary>>(UiState.Idle)
        private set

    fun refreshWallet() {
        walletUi = UiState.Loading
        viewModelScope.launch {
            try {
                walletUi = UiState.Success(apiCall { api.wallet(limit = 30) })
            } catch (e: ApiException) {
                walletUi = UiState.Error(e.message)
            } catch (e: Exception) {
                walletUi = UiState.Error("Network error — is the server running?")
            }
        }
    }
}