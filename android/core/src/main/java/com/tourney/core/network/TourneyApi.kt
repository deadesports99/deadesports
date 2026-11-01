package com.tourney.core.network

import com.tourney.core.model.ApiEnvelope
import com.tourney.core.model.AuthResponse
import com.tourney.core.model.CreateTournamentRequest
import com.tourney.core.model.JoinRequest
import com.tourney.core.model.JoinResult
import com.tourney.core.model.LoginRequest
import com.tourney.core.model.PayoutRequest
import com.tourney.core.model.PayoutResponse
import com.tourney.core.model.PublishRoomRequest
import com.tourney.core.model.RegisterRequest
import com.tourney.core.model.RoomCredentials
import com.tourney.core.model.ScoreboardResponse
import com.tourney.core.model.SlotsResponse
import com.tourney.core.model.Tournament
import com.tourney.core.model.TournamentListResponse
import com.tourney.core.model.User
import com.tourney.core.model.WalletSummary
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
}