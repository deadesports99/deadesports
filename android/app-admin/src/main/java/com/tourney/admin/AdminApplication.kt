package com.tourney.admin

import android.app.Application
import com.tourney.core.network.ApiClient

/** Admin app entry — wires the white-label API client once. */
class AdminApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ApiClient.init(this)
    }
}