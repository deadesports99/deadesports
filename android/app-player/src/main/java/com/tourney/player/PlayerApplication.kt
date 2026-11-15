package com.tourney.player

import android.app.Application
import com.tourney.core.fcm.FcmTokenSync
import com.tourney.core.network.ApiClient

/** Player app entry — wires the white-label API client once. */
class PlayerApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ApiClient.init(this)
        // onNewToken fires before login (401), so register the token whenever a
        // session already exists — keeps `User.fcmToken` in sync with the install.
        FcmTokenSync.syncIfLoggedIn(this)
    }
}