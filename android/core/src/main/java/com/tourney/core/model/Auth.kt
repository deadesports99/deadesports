package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ─── Auth DTOs (POST /auth/player/login | register , GET /auth/me) ───────

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val tenantId: String,
    val phoneNumber: String? = null,
    val idToken: String? = null,
)

@JsonClass(generateAdapter = true)
data class GoogleAuthRequest(
    val tenantId: String,
    val idToken: String,
    val deviceId: String? = null,
    val name: String? = null,
)

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val tenantId: String,
    val phoneNumber: String? = null,
    val idToken: String? = null,
    val name: String? = null,
    @Json(name = "inGameName") val inGameName: String? = null,
    @Json(name = "inGameUid") val inGameUid: String? = null,
    @Json(name = "deviceId") val deviceId: String? = null,
)

@JsonClass(generateAdapter = true)
data class SendEmailOtpRequest(
    val tenantId: String,
    val email: String,
    val password: String,
    val name: String? = null,
    val type: String = "REGISTER",
)

@JsonClass(generateAdapter = true)
data class EmailOtpResponse(
    val message: String,
    val email: String,
    val debugOtp: String? = null,
)

@JsonClass(generateAdapter = true)
data class VerifyEmailOtpRequest(
    val tenantId: String,
    val email: String,
    val code: String,
    val password: String,
    val name: String? = null,
    val deviceId: String? = null,
    val type: String = "REGISTER",
)

/** Response of login/register — `{ user, token }`. */
@JsonClass(generateAdapter = true)
data class AuthResponse(
    val user: User,
    val token: String,
)

/** Request to update player's In-Game Free Fire identity (PATCH /players/me/game-profile). */
@JsonClass(generateAdapter = true)
data class UpdateGameProfileRequest(
    @Json(name = "inGameName") val inGameName: String,
    @Json(name = "inGameUid") val inGameUid: String,
)
