package com.tourney.core.network

import com.tourney.core.model.ApiEnvelope
import com.tourney.core.model.AckRequest
import com.tourney.core.model.AdminDepositsResponse
import com.tourney.core.model.AdminPaymentsResponse
import com.tourney.core.model.AdminPlayersResponse
import com.tourney.core.model.BanPlayerRequest
import com.tourney.core.model.BanPlayerResponse
import com.tourney.core.model.ReconcilePaymentResponse
import com.tourney.core.model.ApproveWithdrawalRequest
import com.tourney.core.model.DailySettlement
import com.tourney.core.model.DepositActionResponse
import com.tourney.core.model.DepositSubmitResponse
import com.tourney.core.model.EmailOtpResponse
import com.tourney.core.model.PlayerDepositsResponse
import com.tourney.core.model.SubmitDepositRequest
import com.tourney.core.model.AuthResponse
import com.tourney.core.model.CancelMatchRequest
import com.tourney.core.model.CancelMatchResult
import com.tourney.core.model.CreateStaffRequest
import com.tourney.core.model.CreateTournamentRequest
import com.tourney.core.model.CloneTournamentRequest
import com.tourney.core.model.FcmTokenRequest
import com.tourney.core.model.FcmTokenResponse
import com.tourney.core.model.FinishMatchRequest
import com.tourney.core.model.FinishMatchResult
import com.tourney.core.model.JoinRequest
import com.tourney.core.model.JoinResult
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.GoogleAuthRequest
import com.tourney.core.model.SendEmailOtpRequest
import com.tourney.core.model.VerifyEmailOtpRequest
import com.tourney.core.model.PayoutRequest
import com.tourney.core.model.PayoutResponse
import com.tourney.core.model.CreatePaymentOrderRequest
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.model.PaymentOrderStatus
import com.tourney.core.model.PaymentGatewayInfo
import com.tourney.core.model.VerifyPaymentRequest
import com.tourney.core.model.VerifyPaymentResponse
import com.tourney.core.model.PlayerStats
import com.tourney.core.model.PublishRoomRequest
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.RejectWithdrawalRequest
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.RoomRevealRequest
import com.tourney.core.model.ScoreboardResponse
import com.tourney.core.model.SlotsResponse
import com.tourney.core.model.StaffActionResponse
import com.tourney.core.model.StaffListResponse
import com.tourney.core.model.SweepResult
import com.tourney.core.model.TenantSettings
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.UpdateTenantSettingsRequest
import com.tourney.core.model.UpdateStaffRequest
import com.tourney.core.model.UpdateVisibilityRequest
import com.tourney.core.model.UpdateGameProfileRequest
import com.tourney.core.model.User
import com.tourney.core.model.WalletActionResponse
import com.tourney.core.model.WalletSummary
import com.tourney.core.model.WithdrawRequest
import com.tourney.core.model.WithdrawResponse
import com.tourney.core.model.WithdrawalsResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import okhttp3.ResponseBody
import retrofit2.http.Streaming

/**
 * Retrofit contract — mirrors the Node/TS backend 1:1.
 * Every method returns the standard `{success, message, data, statusCode}`
 * envelope; `ApiCall.safe` unwraps `.data` (or maps errors to ApiException).
 */
interface TourneyApi {

    // ─── Auth ────────────────────────────────────────────────────────────
    @POST("auth/player/register")
    suspend fun register(@Body request: RegisterRequest): ApiEnvelope<AuthResponse>

    @POST("auth/player/login")
    suspend fun login(@Body request: LoginRequest): ApiEnvelope<AuthResponse>

    @POST("auth/player/google")
    suspend fun googleLogin(@Body request: GoogleAuthRequest): ApiEnvelope<AuthResponse>

    @POST("auth/player/email/send-otp")
    suspend fun sendEmailOtp(@Body request: SendEmailOtpRequest): ApiEnvelope<EmailOtpResponse>

    @POST("auth/player/email/verify-otp")
    suspend fun verifyEmailOtp(@Body request: VerifyEmailOtpRequest): ApiEnvelope<AuthResponse>

    @GET("auth/me")
    suspend fun me(): ApiEnvelope<User>

    @POST("auth/fcm-token")
    suspend fun registerFcmToken(@Body request: FcmTokenRequest): ApiEnvelope<FcmTokenResponse>

    // ─── Staff / Sub-Admin management (ADMIN only) ───────────────────────
    @GET("auth/admin/staff")
    suspend fun staffList(): ApiEnvelope<StaffListResponse>

    @POST("auth/admin/staff")
    suspend fun createStaff(@Body request: CreateStaffRequest): ApiEnvelope<AuthResponse>

    @PATCH("auth/admin/staff/{id}")
    suspend fun updateStaff(
        @Path("id") id: String,
        @Body request: UpdateStaffRequest,
    ): ApiEnvelope<StaffActionResponse>

    @DELETE("auth/admin/staff/{id}")
    suspend fun removeStaff(@Path("id") id: String): ApiEnvelope<StaffActionResponse>

    // ─── Tournaments ─────────────────────────────────────────────────────
    @POST("tournaments")
    suspend fun createTournament(@Body request: CreateTournamentRequest): ApiEnvelope<Tournament>

    @GET("tournaments")
    suspend fun listTournaments(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 25,
        /** Admin Publish Room picker: only upcoming/open matches (no stale ones). */
        @Query("publishable") publishable: Boolean? = null,
    ): ApiEnvelope<TournamentListResponse>

    @GET("tournaments/{id}")
    suspend fun tournamentDetails(@Path("id") id: String): ApiEnvelope<Tournament>

    @GET("tournaments/{id}/slots")
    suspend fun tournamentSlots(@Path("id") id: String): ApiEnvelope<SlotsResponse>

    @POST("tournaments/{id}/join")
    suspend fun joinTournament(
        @Path("id") id: String,
        @Body request: JoinRequest,
    ): ApiEnvelope<JoinResult>

    /** Phase 7: 1-Tap Tournament Clone (re-schedule proven match in seconds). */
    @POST("tournaments/{id}/clone")
    suspend fun cloneTournament(
        @Path("id") id: String,
        @Body request: CloneTournamentRequest,
    ): ApiEnvelope<Tournament>

    /** Phase 8: admin tunes when the match appears in the player list. */
    @PATCH("tournaments/{id}/visibility")
    suspend fun updateTournamentVisibility(
        @Path("id") id: String,
        @Body request: UpdateVisibilityRequest,
    ): ApiEnvelope<Tournament>

    // ─── Room (admin-controlled reveal) ──────────────────────────────────
    @GET("tournaments/{id}/room")
    suspend fun roomCredentials(@Path("id") id: String): ApiEnvelope<RoomCredentials>

    @PATCH("tournaments/{id}/room")
    suspend fun publishRoom(
        @Path("id") id: String,
        @Body request: PublishRoomRequest,
    ): ApiEnvelope<RoomCredentials>

    /** Phase 9: choose WHEN players see the Room ID & Password (or reveal now). */
    @PATCH("tournaments/{id}/room-reveal")
    suspend fun updateRoomReveal(
        @Path("id") id: String,
        @Body request: RoomRevealRequest,
    ): ApiEnvelope<RoomCredentials>

    // ─── Official spectator scoreboard + payout ──────────────────────────
    @GET("tournaments/{id}/results")
    suspend fun tournamentResults(@Path("id") id: String): ApiEnvelope<ScoreboardResponse>

    @POST("tournaments/{id}/payout")
    suspend fun payout(
        @Path("id") id: String,
        @Body request: PayoutRequest,
    ): ApiEnvelope<PayoutResponse>

    /** Phase 12: admin ends the match and pays the winner by Free Fire UID. */
    @POST("tournaments/{id}/finish")
    suspend fun finishMatch(
        @Path("id") id: String,
        @Body request: FinishMatchRequest,
    ): ApiEnvelope<FinishMatchResult>

    // ─── Phase 6: admin match operations (lifecycle ops) ────────────────
    /** Advance every match's lifecycle now (T-15 reveal -> LIVE). */
    @POST("tournaments/sweep/states")
    suspend fun sweepMatchStates(): ApiEnvelope<SweepResult>

    /** Cancel a match and atomically refund every booked seat. */
    @POST("tournaments/{id}/cancel")
    suspend fun cancelTournament(
        @Path("id") id: String,
        @Body request: CancelMatchRequest,
    ): ApiEnvelope<CancelMatchResult>

    // ─── Phase 6: runtime tenant settings + player career stats ─────────
    /** Any user or guest: live UPI / payee / WhatsApp / min deposit / auth config. */
    @GET("tenant/settings")
    suspend fun tenantSettings(
        @Query("tenantId") tenantId: String? = null,
    ): ApiEnvelope<TenantSettings>

    /** Owner console read (same payload, ADMIN guarded). */
    @GET("admin/tenant/settings")
    suspend fun adminTenantSettings(): ApiEnvelope<TenantSettings>

    /** Owner-only runtime update — no APK rebuild needed. */
    @PATCH("admin/tenant/settings")
    suspend fun updateTenantSettings(
        @Body request: UpdateTenantSettingsRequest,
    ): ApiEnvelope<TenantSettings>

    /** Profile tab: matches joined/played, Booyahs, kills, total winnings. */
    @GET("players/me/stats")
    suspend fun playerStats(): ApiEnvelope<PlayerStats>

    // ─── Owner-only player management (search + ban/unban) ───────────────
    @GET("admin/players")
    suspend fun adminPlayers(
        @Query("search") search: String? = null,
        @Query("limit") limit: Int = 50,
    ): ApiEnvelope<AdminPlayersResponse>

    @PATCH("admin/players/{id}/ban")
    suspend fun banPlayer(
        @Path("id") id: String,
        @Body request: BanPlayerRequest,
    ): ApiEnvelope<BanPlayerResponse>

    /** Profile tab: update player's Free Fire IGN and UID. */
    @PATCH("players/me/game-profile")
    suspend fun updateGameProfile(@Body request: UpdateGameProfileRequest): ApiEnvelope<User>

    // ─── Wallet ──────────────────────────────────────────────────────────
    @GET("wallet")
    suspend fun wallet(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 25,
    ): ApiEnvelope<WalletSummary>

    /** Add Cash: submit amount + 12-char UTR -> PENDING (admin verifies). */
    @POST("wallet/deposit")
    suspend fun submitDeposit(@Body request: SubmitDepositRequest): ApiEnvelope<DepositSubmitResponse>

    /** Own deposit request history (pending / credited / rejected). */
    @GET("wallet/deposits")
    suspend fun myDeposits(
        @Query("limit") limit: Int = 10,
    ): ApiEnvelope<PlayerDepositsResponse>

    @POST("wallet/withdraw")
    suspend fun withdraw(@Body request: WithdrawRequest): ApiEnvelope<WithdrawResponse>

    // ─── Online payments (Razorpay / mock) ──────────────────────────────
    /** Public gateway info: provider, amount limits, demo flag. */
    @GET("payments/my")
    suspend fun myPayments(
        @Query("status") status: String = "ALL",
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 10,
    ): ApiEnvelope<com.tourney.core.model.PlayerPaymentsResponse>

    @GET("payments/config")
    suspend fun paymentGatewayInfo(): ApiEnvelope<PaymentGatewayInfo>

    /** Create a gateway order for a wallet top-up. `amountPaise` (integer). */
    @POST("payments/orders")
    suspend fun createPaymentOrder(
        @Body request: CreatePaymentOrderRequest,
    ): ApiEnvelope<PaymentOrderCreated>

    /** Poll the server-side truth for one order (CREATED/PENDING/CAPTURED/...). */
    @GET("payments/orders/{id}")
    suspend fun paymentOrder(@Path("id") id: String): ApiEnvelope<PaymentOrderStatus>

    /** Verify the native-checkout signature and settle (idempotent). */
    @POST("payments/verify")
    suspend fun verifyPayment(
        @Body request: VerifyPaymentRequest,
    ): ApiEnvelope<VerifyPaymentResponse>

    /** Reconcile a missed callback/webhook against the gateway. */
    @POST("payments/orders/{id}/sync")
    suspend fun syncPaymentOrder(
        @Path("id") id: String,
        @Body request: Map<String, String> = emptyMap(),
    ): ApiEnvelope<VerifyPaymentResponse>

    // ─── Admin wallet console (canManageWallet) ─────────────────────────
    @GET("admin/wallet/withdrawals")
    suspend fun adminWithdrawals(
        @Query("status") status: String? = null,
    ): ApiEnvelope<WithdrawalsResponse>

    @POST("admin/wallet/withdrawals/{id}/approve")
    suspend fun approveWithdrawal(
        @Path("id") id: String,
        @Body request: ApproveWithdrawalRequest,
    ): ApiEnvelope<WalletActionResponse>

    @POST("admin/wallet/withdrawals/{id}/reject")
    suspend fun rejectWithdrawal(
        @Path("id") id: String,
        @Body request: RejectWithdrawalRequest,
    ): ApiEnvelope<WalletActionResponse>

    // ─── Admin deposit verification (Add Cash queue) ────────────────────
    @GET("admin/wallet/deposits")
    suspend fun adminDeposits(
        @Query("status") status: String? = null,
    ): ApiEnvelope<AdminDepositsResponse>

    // ─── Admin online payments (Razorpay / mock top-ups) ─────────────────
    @GET("admin/wallet/payments")
    suspend fun adminPayments(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 30,
    ): ApiEnvelope<AdminPaymentsResponse>

    @POST("admin/wallet/payments/{id}/sync")
    suspend fun adminSyncPayment(
        @Path("id") id: String,
        @Body request: AckRequest = AckRequest(),
    ): ApiEnvelope<ReconcilePaymentResponse>

    @POST("admin/wallet/deposits/{id}/approve")
    suspend fun approveDeposit(
        @Path("id") id: String,
        @Body request: AckRequest = AckRequest(),
    ): ApiEnvelope<DepositActionResponse>

    @POST("admin/wallet/deposits/{id}/reject")
    suspend fun rejectDeposit(
        @Path("id") id: String,
        @Body request: RejectWithdrawalRequest,
    ): ApiEnvelope<DepositActionResponse>

    // ─── Phase 7: Daily settlement reports (ADMIN only) ──────────────────
    @GET("admin/wallet/settlement")
    suspend fun dailySettlement(
        @Query("date") date: String? = null,
    ): ApiEnvelope<DailySettlement>

    @Streaming
    @GET("admin/wallet/settlement/export.csv")
    suspend fun exportSettlementCsv(
        @Query("date") date: String? = null,
    ): ResponseBody
}
