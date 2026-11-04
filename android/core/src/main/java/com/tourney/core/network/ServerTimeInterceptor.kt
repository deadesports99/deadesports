package com.tourney.core.network

import com.tourney.core.util.TimeAuthority
import okhttp3.Interceptor
import okhttp3.Response

/**
 * 🕒 SERVER TIME INTERCEPTOR
 * Intercepts every response from the backend and reads the authoritative
 * `X-Server-Time` timestamp header generated from Supabase / server atomic clock.
 */
class ServerTimeInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)

        val serverTimeHeader = response.header("X-Server-Time")
        serverTimeHeader?.toLongOrNull()?.let { serverTimeMs ->
            TimeAuthority.sync(serverTimeMs, source = "HTTP Header [${request.url.encodedPath}]")
        }

        return response
    }
}
