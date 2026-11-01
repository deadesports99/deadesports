package com.tourney.core.network

import android.content.Context
import android.os.Build
import android.provider.Settings
import com.squareup.moshi.Moshi
import com.tourney.core.datastore.SessionManager
import com.tourney.core.theme.ClientConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Retrofit singleton — base URL + auth wiring come from the app's
 * white-label client_config.json, so each client build talks to its own
 * backend without touching Kotlin code.
 */
object ApiClient {

    lateinit var tourneyApi: TourneyApi
        private set

    lateinit var sessionManager: SessionManager
        private set

    /** Resolved white-label config (base URL + tenant + theme) for this build. */
    lateinit var config: ClientConfig
        private set

    private val moshi: Moshi by lazy { Moshi.Builder().build() }

    private fun isDebugBuild(context: Context): Boolean =
        (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0

    /** Must be called once from each Application class (before any API call). */
    fun init(context: Context) {
        if (::tourneyApi.isInitialized) return

        val config = ClientConfig.load(context.applicationContext)
        this.config = config
        sessionManager = SessionManager(context.applicationContext)

        val logging = HttpLoggingInterceptor().apply {
            level = if (isDebugBuild(context)) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val okHttp = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { sessionManager.currentToken() })
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(config.apiBaseUrl.trimEnd('/') + "/")
            .client(okHttp)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

        tourneyApi = retrofit.create(TourneyApi::class.java)
    }
}

/** Stable per-install device identifier (used for fraud signals on register). */
object DeviceIdProvider {
    fun androidId(context: Context): String =
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
}