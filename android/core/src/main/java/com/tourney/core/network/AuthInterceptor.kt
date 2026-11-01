package com.tourney.core.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor that stamps `Authorization: Bearer <jwt>` on every request.
 * Reads the cached token synchronously (no suspends allowed inside intercept).
 */
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider()
        val request = if (token.isNullOrBlank()) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        }
        return chain.proceed(request)
    }
}