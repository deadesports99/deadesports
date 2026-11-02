package com.tourney.core.network

import com.tourney.core.model.ApiEnvelope
import com.tourney.core.model.AckRequest
import com.tourney.core.model.AdminDepositsResponse
import com.tourney.core.model.ApproveWithdrawalRequest
import com.tourney.core.model.DepositActionResponse
import com.tourney.core.model.DepositSubmitResponse
import com.tourney.core.model.PlayerDepositsResponse
import com.tourney.core.model.SubmitDepositRequest
import com.tourney.core.model.AuthResponse
import com.tourney.core.model.CreateTournamentRequest
import com.tourney.core.model.FcmTokenRequest
import com.tourney.core.model.FcmTokenResponse
import com.tourney.core.model.JoinRequest
import com.tourney.core.model.JoinResult
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.PayoutRequest
import com.tourney.core.model.PayoutResponse
import com.tourney.core.model.PublishRoomRequest
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.RejectWithdrawalRequest
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.ScoreboardResponse
import com.tourney.core.model.SlotsResponse
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.User
import com.tourney.core.model.WalletActionResponse
import com.tourney.core.model.WalletSummary
import com.tourney.core.model.WithdrawRequest
import com.tourney.core.model.WithdrawResponse
import com.tourney.core.model.WithdrawalsResponse
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

    @GET("auth/me")
    suspend fun me(): ApiEnvelope<User>

    @POST("auth/fcm-token")
    suspend fun registerFcmToken(@Body request: FcmTokenRequest): ApiEnvelope<FcmTokenResponse>

    // ─── Tournaments ─────────────────────────────────────────────────────
    @POST("tournaments")
    suspend fun createTournament(@Body request: CreateTournamentRequest): ApiEnvelope<Tournament>

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

    @POST("tournaments/{id}/join")
    suspend fun joinTournament(
        @Path("id") id: String,
        @Body request: JoinRequest,
    ): ApiEnvelope<JoinResult>

    // ─── Room (timed release) ────────────────────────────────────────────
    @GET("tournaments/{id}/room")
    suspend fun roomCredentials(@Path("id") id: String): ApiEnvelope<RoomCredentials>

    @PATCH("tournaments/{id}/room")
    suspend fun publishRoom(
        @Path("id") id: String,
        @Body request: PublishRoomRequest,
    ): ApiEnvelope<RoomCredentials>

    // ─── Official spectator scoreboard + payout ──────────────────────────
    @GET("tournaments/{id}/results")
    suspend fun tournamentResults(@Path("id") id: String): ApiEnvelope<ScoreboardResponse>

    @POST("tournaments/{id}/payout")
    suspend fun payout(
        @Path("id") id: String,
        @Body request: PayoutRequest,
    ): ApiEnvelope<PayoutResponse>

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
}