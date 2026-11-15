package com.tourney.core.fcm

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.tourney.core.model.FcmTokenRequest
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Pushes this install's FCM token to the backend **once a session exists**.
 *
 * Why this exists: `FirebaseMessagingService.onNewToken` fires on the first app start
 * — i.e. before the player logs in — so `POST /auth/fcm-token` answers 401 and the
 * token is never retried. That is why `User.fcmToken` stayed empty and the backend had
 * no address to push to.
 *
 * Call it on app start and immediately after a successful login.
 *
 * Never throws: when `google-services.json` is missing (white-label builds), Firebase
 * is not initialised and the app keeps working exactly as before.
 */
object FcmTokenSync {
    private const val TAG = "FcmTokenSync"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun syncIfLoggedIn(context: Context) {
        scope.launch {
            runCatching {
                if (!ApiClient.sessionManager.current().isLoggedIn) return@runCatching

                val token = fetchToken()
                if (token.isBlank()) return@runCatching

                ApiClient.sessionManager.saveFcmToken(token)
                // Best-effort: a failed sync simply retries on the next launch.
                runCatching {
                    apiCall { ApiClient.tourneyApi.registerFcmToken(FcmTokenRequest(token)) }
                }
                Log.i(TAG, "FCM token synced to backend")
            }.onFailure { Log.w(TAG, "FCM token sync skipped: ${it.message}") }
        }
    }

    private suspend fun fetchToken(): String = suspendCancellableCoroutine { cont ->
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    cont.resume(task.result ?: "")
                } else {
                    cont.resumeWithException(
                        task.exception ?: IllegalStateException("FCM returned no token"),
                    )
                }
            }
    }
}
