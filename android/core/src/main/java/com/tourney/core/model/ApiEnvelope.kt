package com.tourney.core.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Standard backend envelope — every response is wrapped as:
 * `{ "success": bool, "message": string, "data": T?, "statusCode": int }`.
 * Generic so Moshi's codegen resolves any payload type at compile time.
 */
@JsonClass(generateAdapter = true)
data class ApiEnvelope<T>(
    val success: Boolean,
    val message: String,
    val data: T? = null,
    @Json(name = "statusCode") val statusCode: Int = 200,
)

/** Non-2xx response elevated into a typed exception. */
class ApiException(
    val statusCode: Int,
    override val message: String,
    /** Raw `data` object from the error envelope (e.g. secondsUntilReveal). */
    val details: Map<String, Any?> = emptyMap(),
) : Exception(message) {

    /** Room-lock 403 payload: seconds remaining until credentials unlock. */
    fun secondsUntilReveal(): Long? = (details["secondsUntilReveal"] as? Number)?.toLong()
}