package com.tourney.core.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.tourney.core.model.FcmTokenRequest
import com.tourney.core.network.ApiClient
import com.tourney.core.network.apiCall
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * FCM engine — high-priority alerts for ROOM_REVEALED / PRIZE_WON / MATCH_CANCELLED.
 *
 * - onNewToken: caches the device token in DataStore and syncs it to
 *   POST /auth/fcm-token so the backend can address this install.
 * - onMessageReceived: builds a channel-per-type notification with a
 *   deep-link PendingIntent (RoomScreen / ScoreboardScreen via MainActivity).
 *
 * Graceful without Firebase config: if no google-services.json is present,
 * FCM simply never delivers and the app is unaffected.
 */
class TourneyMessagingService : FirebaseMessagingService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        scope.launch {
            try {
                ApiClient.sessionManager.saveFcmToken(token)
                // Sync to backend (best-effort — token simply retries next launch).
                runCatching { apiCall { ApiClient.tourneyApi.registerFcmToken(FcmTokenRequest(token)) } }
            } catch (e: Exception) {
                // Never crash the push pipeline on a token-sync failure.
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val type = message.data["type"] ?: "GENERAL"
        val tournamentId = message.data["tournamentId"]
        val title = message.notification?.title ?: defaultTitle(type)
        val body = message.notification?.body ?: (message.data["body"] ?: "")

        val channelId = createChannel(type)
        val pendingIntent = buildDeepLinkIntent(type, tournamentId)

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(applicationInfo.icon ?: android.R.drawable.ic_menu_compass)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .build()

        try {
            NotificationManagerCompat.from(this).notify(notificationId(type), notification)
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS denied on Android 13+ — silently skip.
        }
    }

    private fun buildDeepLinkIntent(type: String, tournamentId: String?): PendingIntent? {
        val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return null
        intent.putExtra(EXTRA_PUSH_TYPE, type)
        tournamentId?.let { intent.putExtra(EXTRA_TOURNAMENT_ID, it) }
        intent.flags = android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
        return PendingIntent.getActivity(
            this,
            notificationId(type),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createChannel(type: String): String {
        val channelId = channelFor(type)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel(channelId) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        channelId,
                        channelName(type),
                        NotificationManager.IMPORTANCE_HIGH,
                    ).apply {
                        description = "High-priority tournament alerts"
                        enableVibration(true)
                    }
                )
            }
        }
        return channelId
    }

    private fun channelFor(type: String): String = when (type) {
        "ROOM_REVEALED" -> "ff_room_alerts"
        "PRIZE_WON" -> "ff_prize_alerts"
        "MATCH_CANCELLED" -> "ff_refund_alerts"
        else -> "ff_general_alerts"
    }

    private fun channelName(type: String): String = when (type) {
        "ROOM_REVEALED" -> "Room Released"
        "PRIZE_WON" -> "Prizes & Payouts"
        "MATCH_CANCELLED" -> "Refunds"
        else -> "Tournament Alerts"
    }

    private fun defaultTitle(type: String): String = when (type) {
        "ROOM_REVEALED" -> "🏟 Room ID Released!"
        "PRIZE_WON" -> "💰 Prize Credited!"
        "MATCH_CANCELLED" -> "❌ Match Cancelled"
        else -> "Tournament Alert"
    }

    private fun notificationId(type: String): Int = when (type) {
        "ROOM_REVEALED" -> 1001
        "PRIZE_WON" -> 1002
        "MATCH_CANCELLED" -> 1003
        else -> 1000
    }

    companion object {
        const val EXTRA_PUSH_TYPE = "push_type"
        const val EXTRA_TOURNAMENT_ID = "tournament_id"
    }
}