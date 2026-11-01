package com.tourney.core.network

import com.tourney.core.model.ApiEnvelope
import com.tourney.core.model.ApiException
import org.json.JSONObject
import retrofit2.HttpException

/**
 * Suspended call helper: runs a Retrofit envelope call, unwraps `.data`,
 * and converts non-2xx responses (incl. the jsonwebtoken/error envelopes)
 * into a typed [ApiException] with parsed `details`.
 */
suspend fun <T> apiCall(block: suspend () -> ApiEnvelope<T>): T {
    val envelope = try {
        block()
    } catch (e: HttpException) {
        throw e.toApiException()
    }
    return envelope.data ?: throw ApiException(envelope.statusCode, envelope.message)
}

private fun retrofit2.HttpException.toApiException(): ApiException {
    val raw = try {
        response()?.errorBody()?.string() ?: ""
    } catch (e: Exception) {
        ""
    }
    return try {
        val json = JSONObject(raw)
        val message = json.optString("message", code().toString())
        val details = json.optJSONObject("data")?.let { obj ->
            buildMap {
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    put(key, obj.opt(key))
                }
            }
        } ?: emptyMap()
        ApiException(code(), message, details)
    } catch (e: Exception) {
        ApiException(code(), "Server error (${code()})")
    }
}