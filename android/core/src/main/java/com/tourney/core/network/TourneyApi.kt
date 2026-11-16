package com.tourney.core.network

import com.tourney.core.model.ApiEnvelope
import com.tourney.core.model.DepositSubmitResponse
import com.tourney.core.model.EmailOtpResponse
import com.tourney.core.model.PlayerDepositsResponse
import com.tourney.core.model.SubmitDepositRequest
import com.tourney.core.model.AuthResponse
import com.tourney.core.model.FcmTokenRequest
import com.tourney.core.model.FcmTokenResponse
import com.tourney.core.model.JoinRequest
import com.tourney.core.model.JoinResult
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.GoogleAuthRequest
import com.tourney.core.model.SendEmailOtpRequest
import com.tourney.core.model.VerifyEmailOtpRequest
import com.tourney.core.model.CreatePaymentOrderRequest
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.model.PaymentOrderStatus
import com.tourney.core.model.PaymentGatewayInfo
import com.tourney.core.model.VerifyPaymentRequest
import com.tourney.core.model.VerifyPaymentResponse
import com.tourney.core.model.PlayerStats
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.ScoreboardResponse
import com.tourney.core.model.SlotsResponse
import com.tourney.core.model.TenantSettings
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.UpdateGameProfileRequest
import com.tourney.core.model.User
import com.tourney.core.model.WalletSummary
import com.tourney.core.model.WithdrawRequest
import com.tourney.core.model.WithdrawResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

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




    // ─── Tournaments ─────────────────────────────────────────────────────

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

    /** Phase 8: admin tunes when the match appears in the player list. */

    // ─── Room (admin-controlled reveal) ──────────────────────────────────
    @GET("tournaments/{id}/room")
    suspend fun roomCredentials(@Path("id") id: String): ApiEnvelope<RoomCredentials>


    /** Phase 9: choose WHEN players see the Room ID & Password (or reveal now). */

    // ─── Official spectator scoreboard + payout ──────────────────────────
    @GET("tournaments/{id}/results")
    suspend fun tournamentResults(@Path("id") id: String): ApiEnvelope<ScoreboardResponse>


    /** Phase 12: admin ends the match and pays the winner by Free Fire UID. */

    // ─── Phase 6: admin match operations (lifecycle ops) ────────────────
    /** Advance every match's lifecycle now (T-15 reveal -> LIVE). */


    /** Cancel a match and atomically refund every booked seat. */

    // ─── Phase 6: runtime tenant settings + player career stats ─────────
    /** Any user or guest: live UPI / payee / WhatsApp / min deposit / auth config. */
    @GET("tenant/settings")
    suspend fun tenantSettings(
        @Query("tenantId") tenantId: String? = null,
    ): ApiEnvelope<TenantSettings>

    /** Owner console read (same payload, ADMIN guarded). */

    /** Owner-only runtime update — no APK rebuild needed. */

    /** Profile tab: matches joined/played, Booyahs, kills, total winnings. */
    @GET("players/me/stats")
    suspend fun playerStats(): ApiEnvelope<PlayerStats>

    // ─── Owner-only player management (search + ban/unban) ───────────────


    /** Phase 12.3: one player in full — match history, rewards, cheat signals. */

    /** Phase 12.4: accounts worth investigating, ranked by suspicion score. */

    /** Phase 12.5: devices with 2+ accounts, ranked by how they look. */

    /** Phase 12.5: every account on one device + the matches they met in. */

    /** Phase 12.6: device watchlist — early warning for returning cheaters. */




    /** Phase 12.6: export the whole device as CSV. */

    /** Phase 12.5: ban/unban every account on a device in one action. */

    // ─── Phase 12: match roster (participants · rewards · cheat flags · ban) ──
    /** Everyone booked in this match + server-computed cheat flags. */

    /** Pay one or more players of this match (rank + kills, optional completion). */

    /** Ban from this match only, or across the whole account. */
    /** Ban from this match only, or across the whole account. */


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



    // ─── Admin deposit verification (Add Cash queue) ────────────────────

    // ─── Admin online payments (Razorpay / mock top-ups) ─────────────────




    // ─── Phase 7: Daily settlement reports (ADMIN only) ──────────────────

}
