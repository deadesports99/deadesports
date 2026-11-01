package com.tourney.player

import android.app.Application
import com.tourney.core.network.ApiClient

/** Player app entry — wires the white-label API client once. */
class PlayerApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ApiClient.init(this)
    }
}