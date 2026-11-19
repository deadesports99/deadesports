package com.tourney.core.network

import com.tourney.core.model.ApiEnvelope
import com.tourney.core.model.DepositSubmitResponse
import com.tourney.core.model.PlayerDepositsResponse
import com.tourney.core.model.SubmitDepositRequest
import com.tourney.core.model.AuthResponse
import com.tourney.core.model.FcmTokenRequest
import com.tourney.core.model.FcmTokenResponse
import com.tourney.core.model.JoinRequest
import com.tourney.core.model.JoinedPlayersResponse
import com.tourney.core.model.ApplyReferralRequest
import com.tourney.core.model.MatchStatusResponse
import com.tourney.core.model.RewardClaimAck
import com.tourney.core.model.ReferralInfo
import com.tourney.core.model.RewardsSummary
import com.tourney.core.model.JoinResult
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.GoogleAuthRequest
import com.tourney.core.model.CreatePaymentOrderRequest
import com.tourney.core.model.PaymentOrderCreated
import com.tourney.core.model.PaymentOrderStatus
import com.tourney.core.model.PaymentGatewayInfo
import com.tourney.core.model.VerifyPaymentRequest
import com.tourney.core.model.VerifyPaymentResponse
import com.tourney.core.model.MyMatchesResponse
import com.tourney.core.model.PlayerStats
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.RoomCredentials
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

    @GET("auth/me")
    suspend fun me(): ApiEnvelope<User>

    @POST("auth/fcm-token")
    suspend fun registerFcmToken(@Body request: FcmTokenRequest): ApiEnvelope<FcmTokenResponse>

    // ─── Tournaments ─────────────────────────────────────────────────────

    @GET("tournaments")
    suspend fun listTournaments(
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 25,
    ): ApiEnvelope<TournamentListResponse>

    @GET("tournaments/{id}")
    suspend fun tournamentDetails(@Path("id") id: String): ApiEnvelope<Tournament>

    @GET("tournaments/{id}/slots")
    suspend fun tournamentSlots(@Path("id") id: String): ApiEnvelope<SlotsResponse>

    /** Public seat list: slot number + IGN only, earliest join first. */
    @GET("tournaments/{id}/players")
    suspend fun tournamentPlayers(@Path("id") id: String): ApiEnvelope<JoinedPlayersResponse>

    @POST("tournaments/{id}/join")
    suspend fun joinTournament(
        @Path("id") id: String,
        @Body request: JoinRequest,
    ): ApiEnvelope<JoinResult>

    // ─── Room (admin-controlled reveal) ──────────────────────────────────
    @GET("tournaments/{id}/room")
    suspend fun roomCredentials(@Path("id") id: String): ApiEnvelope<RoomCredentials>

    /** Official spectator scoreboard: placement, verified kills and prize paid. */
    @GET("tournaments/{id}/results")
    suspend fun tournamentResults(@Path("id") id: String): ApiEnvelope<MatchStatusResponse>

    // ─── Phase 6: runtime tenant settings + player career stats ─────────
    /** Any user or guest: live UPI / payee / WhatsApp / min deposit / auth config. */
    @GET("tenant/settings")
    suspend fun tenantSettings(
        @Query("tenantId") tenantId: String? = null,
    ): ApiEnvelope<TenantSettings>

    /** Profile tab: matches joined/played, Booyahs, kills, total winnings. */
    @GET("players/me/stats")
    suspend fun playerStats(): ApiEnvelope<PlayerStats>

    /**
     * My Matches tab: every seat the player booked, with the verified result,
     * refund and room state. `bucket` = all | upcoming | live | completed | cancelled.
     */
    @GET("players/me/matches")
    suspend fun myMatches(
        @Query("bucket") bucket: String = "all",
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): ApiEnvelope<MyMatchesResponse>

    /** Profile tab: update player's Free Fire IGN and UID. */
    @PATCH("players/me/game-profile")
    suspend fun updateGameProfile(@Body request: UpdateGameProfileRequest): ApiEnvelope<User>

    // ─── Rewards: referral · daily bonus · tasks ─────────────────────────
    /** The whole Rewards tab in one call (each block optional per server flags). */
    @GET("rewards/summary")
    suspend fun rewardsSummary(): ApiEnvelope<RewardsSummary>

    /** One claim per IST day; 409 when already claimed. */
    @POST("rewards/daily-bonus/claim")
    suspend fun claimDailyBonus(): ApiEnvelope<RewardClaimAck>

    /** Credit a completed task; 409 when already claimed. */
    @POST("rewards/tasks/{id}/claim")
    suspend fun claimTask(@Path("id") id: String): ApiEnvelope<RewardClaimAck>

    @GET("rewards/referral")
    suspend fun referralInfo(): ApiEnvelope<ReferralInfo>

    /** Attach an inviter's code (one time per account). */
    @POST("rewards/referral/apply")
    suspend fun applyReferralCode(@Body request: ApplyReferralRequest): ApiEnvelope<ReferralInfo>

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

}
