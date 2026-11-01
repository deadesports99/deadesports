package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ─── Auth DTOs (POST /auth/player/login | register , GET /auth/me) ───────

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val tenantId: String,
    val phoneNumber: String,
)

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val tenantId: String,
    val phoneNumber: String,
    @Json(name = "inGameName") val inGameName: String,
    @Json(name = "inGameUid") val inGameUid: String,
    @Json(name = "deviceId") val deviceId: String? = null,
)

/** Response of login/register — `{ user, token }`. */
@JsonClass(generateAdapter = true)
data class AuthResponse(
    val user: User,
    val token: String,
)