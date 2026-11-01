package com.tourney.player

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tourney.core.model.ApiException
import com.tourney.core.model.JoinRequest
import com.tourney.core.model.JoinResult
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.ScoreboardResponse
import com.tourney.core.model.SlotsResponse
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import kotlinx.coroutines.launch

/** Timed-room state: locked countdown vs. ready credentials. */
sealed interface RoomState {
    data object Idle : RoomState
    data object Loading : RoomState
    /** Backend 403 — credentials unlock after [secondsUntilReveal]. */
    data class Locked(
        val secondsUntilReveal: Long,
        val unlockAt: String?,
        val message: String,
    ) : RoomState
    /** Credentials visible (T-15 unlocked or staff bypass). */
    data class Ready(val credentials: RoomCredentials) : RoomState
    data class Error(val message: String) : RoomState
}

/**
 * Per-tournament operations: seat grid, atomic join (squad codes), timed room
 * credentials, and the official spectator scoreboard.
 */
class MatchViewModel(app: Application) : AndroidViewModel(app) {

    private val api get() = ApiClient.tourneyApi

    // ─── Slots + join ────────────────────────────────────────────────────
    var slotsUi by mutableStateOf<UiState<SlotsResponse>>(UiState.Idle)
        private set

    var joining by mutableStateOf(false)
        private set

    /** Successful join — may include a squad `teamCode` for the leader. */
    var lastJoinResult by mutableStateOf<JoinResult?>(null)
        private set

    var actionError by mutableStateOf<String?>(null)
        private set

    fun loadSlots(tournamentId: String) {
        slotsUi = UiState.Loading
        viewModelScope.launch {
            try {
                slotsUi = UiState.Success(apiCall { api.tournamentSlots(tournamentId) })
            } catch (e: ApiException) {
                slotsUi = UiState.Error(e.message)
            } catch (e: Exception) {
                slotsUi = UiState.Error("Network error — is the server running?")
            }
        }
    }

    fun join(tournamentId: String, slotNumber: Int, teamCode: String?) {
        if (joining) return
        joining = true
        actionError = null
        viewModelScope.launch {
            try {
                lastJoinResult = apiCall {
                    api.joinTournament(
                        tournamentId,
                        JoinRequest(slotNumber = slotNumber, teamCode = teamCode?.takeIf { it.isNotBlank() }),
                    )
                }
            } catch (e: ApiException) {
                actionError = e.message
            } catch (e: Exception) {
                actionError = "Network error — is the server running?"
            } finally {
                joining = false
                // Seats changed (ours booked / squad filled) — reload.
                loadSlots(tournamentId)
            }
        }
    }

    fun clearActionError() { actionError = null }

    // ─── Timed room ──────────────────────────────────────────────────────
    var roomState by mutableStateOf<RoomState>(RoomState.Idle)
        private set

    var roomRefreshing by mutableStateOf(false)
        private set

    fun loadRoom(tournamentId: String) {
        roomState = RoomState.Loading
        fetchRoom(tournamentId)
    }

    /** Re-poll (used when the countdown hits zero, or manually on retry). */
    fun refreshRoom(tournamentId: String) {
        roomRefreshing = true
        fetchRoom(tournamentId)
    }

    private fun fetchRoom(tournamentId: String) {
        viewModelScope.launch {
            try {
                val creds = apiCall { api.roomCredentials(tournamentId) }
                roomState = RoomState.Ready(creds)
            } catch (e: ApiException) {
                val seconds = e.secondsUntilReveal()
                roomState = if (seconds != null && e.statusCode == 403) {
                    RoomState.Locked(
                        secondsUntilReveal = seconds,
                        unlockAt = e.details["unlockAt"] as? String,
                        message = e.message,
                    )
                } else {
                    RoomState.Error(e.message)
                }
            } catch (e: Exception) {
                roomState = RoomState.Error("Network error — is the server running?")
            } finally {
                roomRefreshing = false
            }
        }
    }

    // ─── Official scoreboard ─────────────────────────────────────────────
    var scoreboardUi by mutableStateOf<UiState<ScoreboardResponse>>(UiState.Idle)
        private set

    fun loadScoreboard(tournamentId: String) {
        scoreboardUi = UiState.Loading
        viewModelScope.launch {
            try {
                scoreboardUi = UiState.Success(apiCall { api.tournamentResults(tournamentId) })
            } catch (e: ApiException) {
                scoreboardUi = UiState.Error(e.message)
            } catch (e: Exception) {
                scoreboardUi = UiState.Error("Network error — is the server running?")
            }
        }
    }
}