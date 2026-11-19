package com.tourney.player

import android.util.Log

/**
 * 🎛️ REWARD MODULE SWITCHES — Referral · Daily Bonus · Tasks · Earn hub.
 *
 * Two gates, both must be ON for a module to exist in the UI and to be allowed to
 * call its API:
 *
 *  1. **BUILD gate** (`BuildConfig.FEATURE_*`) — baked from `client_config.json`
 *     at build time:
 *     `"features": { "referral": true, "daily_bonus": false, … }`, or per-build
 *     with `-Pfeature.referral=false`. A `false` here means the screen is not
 *     shipped at all (R8 can strip it) — flip the JSON and rebuild to toggle.
 *
 *  2. **SERVER gate** — `features` object of `GET /tenant/settings`. The server
 *     can only SUBTRACT: an APK built with a module off never turns it back on,
 *     but an APK built with it on can have it hidden without a new release
 *     (support / kill switch). Applied from PlayerViewModel on login + resume.
 *
 * Everything in this file is deliberately a plain `val` so Compose reads it
 * during composition; there is no state to observe.
 */
object FeatureFlags {

    /** Baked into this APK — see app-player/build.gradle.kts. */
    val buildReferral: Boolean = BuildConfig.FEATURE_REFERRAL
    val buildDailyBonus: Boolean = BuildConfig.FEATURE_DAILY_BONUS
    val buildTasks: Boolean = BuildConfig.FEATURE_TASKS
    val buildEarnHub: Boolean = BuildConfig.FEATURE_EARN_HUB
    val buildRewardsPush: Boolean = BuildConfig.FEATURE_REWARDS_PUSH

    @Volatile
    private var serverFlags: Map<String, Boolean> = emptyMap()

    /** Called whenever tenant settings arrive (login, resume, manual refresh). */
    fun applyServerFlags(features: Map<String, Boolean>?) {
        serverFlags = features.orEmpty()
    }

    /** True unless the server explicitly said `false` for this key. */
    private fun serverAllows(key: String): Boolean = serverFlags[key] ?: true

    val referral: Boolean get() = buildReferral && serverAllows("referral")
    val dailyBonus: Boolean get() = buildDailyBonus && serverAllows("daily_bonus")
    val tasks: Boolean get() = buildTasks && serverAllows("tasks")

    /** The 5th bottom-bar tab. Never an empty hub. */
    val earnHub: Boolean
        get() = buildEarnHub && serverAllows("earn_hub") && (referral || dailyBonus || tasks)

    /** "Aaj ka bonus ready" push. Off by default; needs FCM too. */
    val rewardsPush: Boolean get() = buildRewardsPush && serverAllows("rewards_push")

    /** Any money-earning surface at all (header pill, wallet card, settings rows). */
    val anyRewards: Boolean get() = earnHub

    /** One line in logcat so QA can prove what a build was compiled with. */
    fun logBuildState() {
        if (!BuildConfig.DEBUG) return
        Log.i(
            "FeatureFlags",
            "build: referral=$buildReferral daily=$buildDailyBonus tasks=$buildTasks " +
                "hub=$buildEarnHub push=$buildRewardsPush",
        )
    }
}
