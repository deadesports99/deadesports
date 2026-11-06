package com.tourney.admin

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tourney.core.datastore.SessionState
import com.tourney.core.model.AckRequest
import com.tourney.core.model.AdminDepositsResponse
import com.tourney.core.model.AdminPaymentsResponse
import com.tourney.core.model.AdminPlayersResponse
import com.tourney.core.model.ApiException
import com.tourney.core.model.ApproveWithdrawalRequest
import com.tourney.core.model.BanPlayerRequest
import com.tourney.core.model.CancelMatchRequest
import com.tourney.core.model.CancelMatchResult
import com.tourney.core.model.CloneTournamentRequest
import com.tourney.core.model.CreateStaffRequest
import com.tourney.core.model.CreateTournamentRequest
import com.tourney.core.model.FinishMatchRequest
import com.tourney.core.model.FinishMatchResult
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.PayoutRequest
import com.tourney.core.model.PayoutResponse
import com.tourney.core.model.PayoutResultInput
import com.tourney.core.model.PublishRoomRequest
import com.tourney.core.model.RejectWithdrawalRequest
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.RoomRevealRequest
import com.tourney.core.model.ReconcilePaymentResponse
import com.tourney.core.model.SlotsResponse
import com.tourney.core.model.StaffListResponse
import com.tourney.core.model.StaffPermissions
import com.tourney.core.model.SweepResult
import com.tourney.core.model.DailySettlement
import com.tourney.core.model.TenantSettings
import com.tourney.core.model.UpdateTenantSettingsRequest
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.UpdateStaffRequest
import com.tourney.core.model.UpdateVisibilityRequest
import com.tourney.core.model.User
import com.tourney.core.model.WithdrawalsResponse
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import com.tourney.core.theme.ThemeMode
import com.tourney.core.ui.formatMoney
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

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

    fun login(phoneNumber: String, idToken: String? = null) {
        authUi = AdminUi.Loading
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

    // ─── Publish Room ID picker: only still-relevant matches ─────────────
    // Old LIVE/COMPLETED matches from previous days must not appear here
    // (the player app hides them too).
    var publishTargetsUi by mutableStateOf<AdminUi<TournamentListResponse>>(AdminUi.Idle)
        private set

    var isPublishTargetsRefreshing by mutableStateOf(false)
        private set

    fun loadPublishTargets() {
        if (publishTargetsUi is AdminUi.Idle || publishTargetsUi is AdminUi.Error) {
            publishTargetsUi = AdminUi.Loading
        }
        isPublishTargetsRefreshing = true
        viewModelScope.launch {
            try {
                publishTargetsUi = AdminUi.Success(
                    apiCall { api.listTournaments(status = null, limit = 50, publishable = true) }
                )
            } catch (e: ApiException) {
                if (publishTargetsUi !is AdminUi.Success) publishTargetsUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                if (publishTargetsUi !is AdminUi.Success) {
                    publishTargetsUi = AdminUi.Error("Network error — is the server running?")
                }
            } finally {
                isPublishTargetsRefreshing = false
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

    fun publishRoom(tournamentId: String, roomId: String, roomPassword: String, revealNow: Boolean = false) {
        publishUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                publishUi = AdminUi.Success(
                    apiCall {
                        api.publishRoom(tournamentId, PublishRoomRequest(roomId, roomPassword, revealNow))
                    }
                )
            } catch (e: ApiException) {
                publishUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                publishUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    // ─── Phase 9: admin-controlled Room ID & Password reveal ─────────────
    var roomRevealBusyId by mutableStateOf<String?>(null)
        private set

    var roomRevealMessage by mutableStateOf<String?>(null)
        private set

    var roomRevealError by mutableStateOf<String?>(null)
        private set

    /**
     * Admin decides when players see the Room ID & Password:
     * change the auto-reveal window (minutes before start) and/or reveal now.
     */
    fun updateRoomReveal(
        tournamentId: String,
        roomRevealMinutes: Int? = null,
        revealNow: Boolean? = null,
    ) {
        if (roomRevealBusyId != null) return
        roomRevealBusyId = tournamentId
        roomRevealMessage = null
        roomRevealError = null
        viewModelScope.launch {
            try {
                val saved = apiCall {
                    api.updateRoomReveal(
                        tournamentId,
                        RoomRevealRequest(roomRevealMinutes = roomRevealMinutes, revealNow = revealNow),
                    )
                }
                roomRevealMessage = when {
                    saved.roomUnlocked == true ->
                        "Room ID & Password are now visible to joined players"
                    saved.roomRevealMinutes != null ->
                        "Saved — players see the room ${saved.roomRevealMinutes} min before start"
                    else -> "Room reveal updated"
                }
                loadMatchOps()
                loadTournaments()
            } catch (e: ApiException) {
                roomRevealError = e.message
            } catch (e: Exception) {
                roomRevealError = "Room reveal update failed — network error"
            } finally {
                roomRevealBusyId = null
            }
        }
    }

    fun clearRoomRevealFeedback() {
        roomRevealMessage = null
        roomRevealError = null
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
                // Only booked seats — empty ones carry no player and would share a blank id.
                scorerParticipants = scorerRoster(slots.slots)
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
                this[idx] = current.copy(rank = rank.coerceIn(1, 48))
            }
        }
    }

    /** Spectator-typed reason shown to players on the scoreboard. */
    fun updateDisqualifyReason(userId: String, reason: String) {
        val idx = scorerParticipants.indexOfFirst { it.userId == userId }
        if (idx >= 0) {
            val current = scorerParticipants[idx]
            scorerParticipants = scorerParticipants.toMutableList().apply {
                this[idx] = current.copy(disqualifyReason = reason.take(120))
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
                            disqualifyReason = if (player.disqualified) {
                                player.disqualifyReason.ifBlank { "Disqualified by spectator" }
                            } else null,
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

    // ─── Deposit verification (canManageWallet) ──────────────────────────
    var depositsUi by mutableStateOf<AdminUi<AdminDepositsResponse>>(AdminUi.Idle)
        private set

    fun loadDeposits(status: String? = "PENDING") {
        depositsUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                depositsUi = AdminUi.Success(apiCall { api.adminDeposits(status = status) })
            } catch (e: ApiException) {
                depositsUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                depositsUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    /** 1-click: verify the UTR and credit the player's deposit balance. */
    fun approveDeposit(id: String) {
        if (walletBusy) return
        walletBusy = true
        walletMessage = null
        walletError = null
        viewModelScope.launch {
            try {
                apiCall { api.approveDeposit(id, AckRequest()) }
                walletMessage = "Deposit approved & balance credited ✓"
                loadDeposits("PENDING")
            } catch (e: ApiException) {
                walletError = e.message
            } catch (e: Exception) {
                walletError = "Network error — is the server running?"
            } finally {
                walletBusy = false
            }
        }
    }

    fun rejectDeposit(id: String, reason: String) {
        if (walletBusy) return
        walletBusy = true
        walletMessage = null
        walletError = null
        viewModelScope.launch {
            try {
                apiCall { api.rejectDeposit(id, RejectWithdrawalRequest(reason)) }
                walletMessage = "Deposit rejected ✓"
                loadDeposits("PENDING")
            } catch (e: ApiException) {
                walletError = e.message
            } catch (e: Exception) {
                walletError = "Network error — is the server running?"
            } finally {
                walletBusy = false
            }
        }
    }

    // ─── Online payments (Razorpay / mock top-ups) ───────────────────────
    // The list + Sync live in `AdminPaymentsController` (unit-tested without
    // Android); this class only wires Retrofit and the shared wallet banner.
    private val paymentsController: AdminPaymentsController = AdminPaymentsController(
        scope = viewModelScope,
        api = object : AdminPaymentsApi {
            override suspend fun list(status: String, page: Int, limit: Int): AdminPaymentsResponse =
                apiCall { api.adminPayments(status = status, page = page, limit = limit) }

            override suspend fun sync(orderId: String): ReconcilePaymentResponse =
                apiCall { api.adminSyncPayment(orderId, AckRequest()) }
        },
        onBusy = { walletBusy = it },
        onFeedback = { message, error ->
            walletMessage = message
            walletError = error
        },
    )

    val paymentsUi: AdminUi<AdminPaymentsResponse> get() = paymentsController.ui

    fun loadPayments(status: String = "ALL") = paymentsController.load(status)

    /** Ask the gateway what really happened and settle if money was captured. */
    fun syncPayment(id: String) = paymentsController.sync(id)

    fun clearWalletFeedback() {
        walletMessage = null
        walletError = null
    }

    // ─── Staff / Sub-Admin management (ADMIN only) ───────────────────────
    var staffUi by mutableStateOf<AdminUi<StaffListResponse>>(AdminUi.Idle)
        private set

    var staffBusy by mutableStateOf(false)
        private set

    var staffMessage by mutableStateOf<String?>(null)
        private set

    var staffError by mutableStateOf<String?>(null)
        private set

    fun loadStaff() {
        staffUi = AdminUi.Loading
        staffError = null
        viewModelScope.launch {
            try {
                staffUi = AdminUi.Success(apiCall { api.staffList() })
            } catch (e: ApiException) {
                staffUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                staffUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    /** Hire a staff member — they log in with the same phone number. */
    fun createStaff(
        name: String,
        email: String,
        phoneNumber: String,
        permissions: StaffPermissions,
    ) {
        if (staffBusy) return
        staffBusy = true
        staffMessage = null
        staffError = null
        viewModelScope.launch {
            try {
                apiCall {
                    api.createStaff(
                        CreateStaffRequest(
                            name = name.trim(),
                            email = email.trim(),
                            phoneNumber = phoneNumber.trim(),
                            permissions = permissions,
                        )
                    )
                }
                staffMessage = "Staff hired ✓"
                loadStaff()
            } catch (e: ApiException) {
                staffError = e.message
            } catch (e: Exception) {
                staffError = "Network error — is the server running?"
            } finally {
                staffBusy = false
            }
        }
    }

    fun updateStaff(
        id: String,
        permissions: StaffPermissions,
        name: String? = null,
        email: String? = null,
        isActive: Boolean? = null,
    ) {
        if (staffBusy) return
        staffBusy = true
        staffMessage = null
        staffError = null
        viewModelScope.launch {
            try {
                apiCall {
                    api.updateStaff(
                        id,
                        UpdateStaffRequest(
                            name = name?.trim()?.takeIf { it.isNotEmpty() },
                            email = email?.trim()?.takeIf { it.isNotEmpty() },
                            permissions = permissions,
                            isActive = isActive,
                        ),
                    )
                }
                staffMessage = "Permissions updated ✓"
                loadStaff()
            } catch (e: ApiException) {
                staffError = e.message
            } catch (e: Exception) {
                staffError = "Network error — is the server running?"
            } finally {
                staffBusy = false
            }
        }
    }

    /** Soft delete — the account keeps its audit history but can no longer log in. */
    fun deactivateStaff(id: String) {
        if (staffBusy) return
        staffBusy = true
        staffMessage = null
        staffError = null
        viewModelScope.launch {
            try {
                apiCall { api.removeStaff(id) }
                staffMessage = "Staff removed ✓"
                loadStaff()
            } catch (e: ApiException) {
                staffError = e.message
            } catch (e: Exception) {
                staffError = "Network error — is the server running?"
            } finally {
                staffBusy = false
            }
        }
    }

    fun clearStaffFeedback() {
        staffMessage = null
        staffError = null
    }

    var isDashboardRefreshing by mutableStateOf(false)
        private set

    // ─── Phase 6: Match Operations (sweep + cancel & refund) ─────────────
    /** Live match list for the operations console (scheduled / live / done). */
    var matchOpsUi by mutableStateOf<AdminUi<TournamentListResponse>>(AdminUi.Idle)
        private set

    var isMatchOpsRefreshing by mutableStateOf(false)
        private set

    var opsBusyMatchId by mutableStateOf<String?>(null)
        private set

    var opsSweeping by mutableStateOf(false)
        private set

    var opsMessage by mutableStateOf<String?>(null)
        private set

    var opsError by mutableStateOf<String?>(null)
        private set

    fun loadMatchOps() {
        if (matchOpsUi is AdminUi.Idle || matchOpsUi is AdminUi.Error) {
            matchOpsUi = AdminUi.Loading
        }
        isMatchOpsRefreshing = true
        viewModelScope.launch {
            try {
                matchOpsUi = AdminUi.Success(apiCall { api.listTournaments(status = null, limit = 50) })
            } catch (e: ApiException) {
                if (matchOpsUi !is AdminUi.Success) matchOpsUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                if (matchOpsUi !is AdminUi.Success) matchOpsUi = AdminUi.Error("Network error — is the server running?")
            } finally {
                isMatchOpsRefreshing = false
            }
        }
    }

    /** Advance every due match now instead of waiting for the 60s scheduler. */
    fun sweepNow() {
        if (opsSweeping) return
        opsSweeping = true
        opsMessage = null
        opsError = null
        viewModelScope.launch {
            try {
                val result = apiCall { api.sweepMatchStates() }
                opsMessage = result.summary
                loadMatchOps()
                loadTournaments()
            } catch (e: ApiException) {
                opsError = e.message
            } catch (e: Exception) {
                opsError = "Sweep failed — network error"
            } finally {
                opsSweeping = false
            }
        }
    }

    /** Cancel a match and refund every booked seat in one transaction. */
    fun cancelMatch(tournamentId: String, reason: String = "Cancelled by organizer") {
        if (opsBusyMatchId != null) return
        opsBusyMatchId = tournamentId
        opsMessage = null
        opsError = null
        viewModelScope.launch {
            try {
                val result: CancelMatchResult = apiCall {
                    api.cancelTournament(tournamentId, CancelMatchRequest(reason.trim()))
                }
                opsMessage = "Match cancelled — ₹${"%.2f".format(java.util.Locale.US, result.totalRefunded)} " +
                    "refunded to ${result.refundedPlayers} player(s)"
                loadMatchOps()
                loadTournaments()
            } catch (e: ApiException) {
                opsError = e.message
            } catch (e: Exception) {
                opsError = "Cancel failed — network error"
            } finally {
                opsBusyMatchId = null
            }
        }
    }

    // ─── Phase 7: Daily settlement + CSV export ───────────────────────────
    var settlementUi by mutableStateOf<AdminUi<DailySettlement>>(AdminUi.Idle)
        private set

    var settlementExporting by mutableStateOf(false)
        private set

    fun loadSettlement(date: String) {
        settlementUi = AdminUi.Loading
        viewModelScope.launch {
            settlementUi = try {
                AdminUi.Success(apiCall { api.dailySettlement(date) })
            } catch (e: ApiException) {
                AdminUi.Error(e.message)
            } catch (e: Exception) {
                AdminUi.Error("Could not load settlement — network error")
            }
        }
    }

    /** Writes the server-generated CSV to cache for a secure Android share URI. */
    fun exportSettlementCsv(date: String, onResult: (File?, String?) -> Unit) {
        if (settlementExporting) return
        settlementExporting = true
        viewModelScope.launch {
            try {
                val response = api.exportSettlementCsv(date)
                val exportDir = File(getApplication<Application>().cacheDir, "exports").apply { mkdirs() }
                val output = File(exportDir, "settlement-$date.csv")
                withContext(kotlinx.coroutines.Dispatchers.IO) {
                    response.byteStream().use { input -> output.outputStream().use { input.copyTo(it) } }
                }
                onResult(output, null)
            } catch (e: ApiException) {
                onResult(null, e.message)
            } catch (e: Exception) {
                onResult(null, "CSV export failed — check your network")
            } finally {
                settlementExporting = false
            }
        }
    }

    // ─── Phase 7: One-tap match cloning ───────────────────────────────────
    var cloneBusyMatchId by mutableStateOf<String?>(null)
        private set

    var cloneMessage by mutableStateOf<String?>(null)
        private set

    var cloneError by mutableStateOf<String?>(null)
        private set

    fun cloneMatch(sourceId: String, matchTime: String, title: String? = null) {
        if (cloneBusyMatchId != null) return
        cloneBusyMatchId = sourceId
        cloneMessage = null
        cloneError = null
        viewModelScope.launch {
            try {
                apiCall {
                    api.cloneTournament(
                        sourceId,
                        CloneTournamentRequest(matchTime = matchTime, title = title?.trim()?.takeIf { it.isNotEmpty() }),
                    )
                }
                cloneMessage = "Match cloned successfully"
                loadMatchOps()
                loadTournaments()
            } catch (e: ApiException) {
                android.util.Log.e("AdminViewModel", "Clone ApiException", e)
                cloneError = e.message
            } catch (e: Exception) {
                android.util.Log.e("AdminViewModel", "Clone Exception", e)
                cloneError = e.message ?: "Clone failed"
            } finally {
                cloneBusyMatchId = null
            }
        }
    }

    fun clearCloneFeedback() {
        cloneMessage = null
        cloneError = null
    }

    // ─── Phase 8: player-feed visibility window (timed listing) ──────────
    var visibilityBusyMatchId by mutableStateOf<String?>(null)
        private set

    var visibilityMessage by mutableStateOf<String?>(null)
        private set

    var visibilityError by mutableStateOf<String?>(null)
        private set

    /**
     * Tune when players can see a match. null = listed immediately,
     * N = lists only in the last N hours before start.
     */
    fun updateMatchVisibility(tournamentId: String, visibilityHours: Int?) {
        if (visibilityBusyMatchId != null) return
        visibilityBusyMatchId = tournamentId
        visibilityMessage = null
        visibilityError = null
        viewModelScope.launch {
            try {
                apiCall {
                    api.updateTournamentVisibility(
                        tournamentId,
                        UpdateVisibilityRequest(visibilityHours = visibilityHours),
                    )
                }
                visibilityMessage = if (visibilityHours == null) {
                    "Visibility updated — players see this match immediately"
                } else {
                    "Visibility updated — lists only in the last $visibilityHours hours"
                }
                loadMatchOps()
                loadTournaments()
            } catch (e: ApiException) {
                visibilityError = e.message
            } catch (e: Exception) {
                visibilityError = "Visibility update failed — network error"
            } finally {
                visibilityBusyMatchId = null
            }
        }
    }

    fun clearVisibilityFeedback() {
        visibilityMessage = null
        visibilityError = null
    }

    fun clearOpsFeedback() {
        opsMessage = null
        opsError = null
    }

    // ─── Phase 6: Runtime settings (UPI / WhatsApp / min deposit) ────────
    var settingsUi by mutableStateOf<AdminUi<TenantSettings>>(AdminUi.Idle)
        private set

    var settingsSaving by mutableStateOf(false)
        private set

    var settingsMessage by mutableStateOf<String?>(null)
        private set

    var settingsError by mutableStateOf<String?>(null)
        private set

    fun loadSettings() {
        settingsUi = AdminUi.Loading
        viewModelScope.launch {
            settingsUi = try {
                AdminUi.Success(apiCall { api.adminTenantSettings() })
            } catch (e: ApiException) {
                AdminUi.Error(e.message)
            } catch (e: Exception) {
                AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    fun saveSettings(
        upiId: String,
        upiName: String,
        supportWhatsapp: String,
        minDeposit: Int,
        allowPhoneAuth: Boolean = true,
        allowEmailAuth: Boolean = true,
        allowGoogleAuth: Boolean = true,
    ) {
        if (settingsSaving) return
        settingsSaving = true
        settingsMessage = null
        settingsError = null
        viewModelScope.launch {
            try {
                val saved = apiCall {
                    api.updateTenantSettings(
                        UpdateTenantSettingsRequest(
                            upiId = upiId.trim(),
                            upiName = upiName.trim(),
                            supportWhatsapp = supportWhatsapp.trim(),
                            minDeposit = minDeposit,
                            allowPhoneAuth = allowPhoneAuth,
                            allowEmailAuth = allowEmailAuth,
                            allowGoogleAuth = allowGoogleAuth,
                        )
                    )
                }
                settingsUi = AdminUi.Success(saved)
                settingsMessage = "Saved — the Player app QR & support link update instantly."
            } catch (e: ApiException) {
                settingsError = e.message
            } catch (e: Exception) {
                settingsError = "Save failed — network error"
            } finally {
                settingsSaving = false
            }
        }
    }

    fun clearSettingsFeedback() {
        settingsMessage = null
        settingsError = null
    }

    // ─── Appearance (shared Light / Dark preference) ─────────────────────
    val themeModeFlow: Flow<ThemeMode> = session.themeMode

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { session.saveThemeMode(mode) }
    }

    /** Dashboard pull-to-refresh: re-sync the match list + wallet queues. */
    fun refreshDashboard() {
        isDashboardRefreshing = true
        viewModelScope.launch {
            try {
                loadTournaments()
                loadWithdrawals("PENDING")
                loadDeposits("PENDING")
                loadMatchOps()
            } finally {
                isDashboardRefreshing = false
            }
        }
    }

    // ─── Phase 12: End Match & Pay Winner by Free Fire UID ───────────────
    var finishBusyMatchId by mutableStateOf<String?>(null)
        private set

    var finishMessage by mutableStateOf<String?>(null)
        private set

    var finishError by mutableStateOf<String?>(null)
        private set

    /** One-click match finish: credits rank-1 prize to the winner's wallet. */
    fun finishMatch(tournamentId: String, winnerUid: String, winnerKills: Int?) {
        if (finishBusyMatchId != null) return
        finishBusyMatchId = tournamentId
        finishMessage = null
        finishError = null
        viewModelScope.launch {
            try {
                val result: FinishMatchResult = apiCall {
                    api.finishMatch(
                        tournamentId,
                        FinishMatchRequest(winnerUid = winnerUid.trim(), winnerKills = winnerKills),
                    )
                }
                val winner = result.winner
                finishMessage = buildString {
                    append("🏆 Match ended — winner ")
                    append(winner?.playerCode ?: winner?.inGameName ?: winner?.inGameUid ?: "declared")
                    append(" paid ₹${formatMoney(result.totalPaid)}")
                    if ((winner?.kills ?: 0) > 0) append(" (${winner?.kills} kills)")
                }
                loadMatchOps()
                loadTournaments()
            } catch (e: ApiException) {
                finishError = e.message
            } catch (e: Exception) {
                finishError = "Match finish failed — network error"
            } finally {
                finishBusyMatchId = null
            }
        }
    }

    fun clearFinishFeedback() {
        finishMessage = null
        finishError = null
    }

    // ─── Phase 12: Player management (owner only) ────────────────────────
    var playersUi by mutableStateOf<AdminUi<AdminPlayersResponse>>(AdminUi.Idle)
        private set

    var playerBanBusyId by mutableStateOf<String?>(null)
        private set

    var playerAdminMessage by mutableStateOf<String?>(null)
        private set

    var playerAdminError by mutableStateOf<String?>(null)
        private set

    fun loadPlayers(search: String = "") {
        lastPlayersQuery = search
        playersUi = AdminUi.Loading
        viewModelScope.launch {
            try {
                playersUi = AdminUi.Success(
                    apiCall { api.adminPlayers(search = search.takeIf { it.isNotBlank() }) }
                )
            } catch (e: ApiException) {
                playersUi = AdminUi.Error(e.message)
            } catch (e: Exception) {
                playersUi = AdminUi.Error("Network error — is the server running?")
            }
        }
    }

    fun setPlayerBanned(playerId: String, banned: Boolean) {
        if (playerBanBusyId != null) return
        playerBanBusyId = playerId
        playerAdminMessage = null
        playerAdminError = null
        viewModelScope.launch {
            try {
                val result = apiCall {
                    api.banPlayer(playerId, BanPlayerRequest(isBanned = banned))
                }
                playerAdminMessage = if (result.isBanned) {
                    "🚫 Player ${result.playerCode ?: ""} banned — sessions killed instantly"
                } else {
                    "✅ Player ${result.playerCode ?: ""} unbanned"
                }
                loadPlayers((lastPlayersQuery))
            } catch (e: ApiException) {
                playerAdminError = e.message
            } catch (e: Exception) {
                playerAdminError = "Action failed — network error"
            } finally {
                playerBanBusyId = null
            }
        }
    }

    var lastPlayersQuery by mutableStateOf("")
        private set

    fun clearPlayerAdminFeedback() {
        playerAdminMessage = null
        playerAdminError = null
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
    val disqualifyReason: String = "Hacking / teaming",
)
