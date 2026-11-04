package com.tourney.core.security

import android.os.Build
import java.io.File

/**
 * Competitive-integrity security checker.
 *
 * Detects Android PC emulators and rooted devices so the platform can keep
 * gameplay fair for physical mobile touch players (Phase 6B — Security
 * Hardening & Anti-Fraud Engine).
 */
enum class DeviceTrust {
    /** Physical phone with no root indicators — allowed to compete. */
    SECURE,

    /** PC emulator (BlueStacks / Nox / LDPlayer / Genymotion / QEMU...). */
    EMULATOR,

    /** Physical device, but rooted (su binaries / test-keys / Magisk). */
    ROOTED,
}

object SecurityChecker {

    // ─── Emulator fingerprints (PC emulators + the AOSP "sdk" profiles) ──
    private val EMULATOR_FINGERPRINT = listOf(
        "generic", "unknown", "emu", "vbox", "bluestacks",
        "nox", "ldplayer", "genymotion", "qemu", "goldfish", "ranchu",
        "sdk", "android_sdk", "mumu", "virtual",
    )

    private val EMULATOR_HARDWARE = listOf(
        "goldfish", "ranchu", "qemu", "nox", "bluestacks", "vbox",
        "intel", "uml", "redroid", "ttvm", "emulator",
    )

    private val EMULATOR_PRODUCT = listOf(
        "sdk", "google_sdk", "sdk_gphone", "vbox86", "nox", "bluestacks",
        "ldplayer", "mumu", "generic", "emulator",
    )

    private val EMULATOR_MANUFACTURER = listOf(
        "unknown", "genymotion", "bluestacks", "nox", "netease", "duckstation",
    )

    private val EMULATOR_BRAND = listOf("generic", "vbox", "bluestacks", "nox", "unknown")

    private val EMULATOR_MODEL = listOf(
        "google sdk", "emulator", "android sdk built for x86", "bluestacks",
        "nox", "ldplayer", "mumu", "sdk_gphone", "droid4x",
    )

    // ─── Root indicators ─────────────────────────────────────────────────
    private val ROOT_BINARIES = listOf(
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/system/app/Superuser.apk",
        "/system/etc/init.d/99SuperSUDaemon",
        "/system/xbin/daemonsu",
        "/system/bin/.ext/.su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/system/app/magisk.apk",
        "/data/adb/magisk",
        "/sbin/.magisk",
    )

    /** True when the device looks like a PC emulator (or an AOSP SDK image). */
    fun isEmulator(): Boolean {
        val fingerprint = Build.FINGERPRINT.lowercase()
        val hardware = Build.HARDWARE.lowercase()
        val product = Build.PRODUCT.lowercase()
        val manufacturer = Build.MANUFACTURER.lowercase()
        val board = Build.BOARD.lowercase()
        val brand = Build.BRAND.lowercase()
        val model = Build.MODEL.lowercase()

        if (EMULATOR_FINGERPRINT.any { fingerprint.contains(it) }) return true
        if (EMULATOR_HARDWARE.any { hardware.contains(it) }) return true
        if (EMULATOR_PRODUCT.any { product.contains(it) }) return true
        if (EMULATOR_MANUFACTURER.any { manufacturer.contains(it) }) return true
        if (EMULATOR_BRAND.any { brand == it }) return true
        if (EMULATOR_MODEL.any { model.contains(it) }) return true

        // Classic emulator board cores (Android Studio / Genymotion / QEMU).
        if (board.contains("goldfish") || board.contains("ranchu")) return true
        if (hardware.contains("vbox")) return true

        return false
    }

    /** True when a su / Superuser / Magisk binary or test-keys build is found. */
    fun isRooted(): Boolean {
        // 1) Known su / Superuser / Magisk binaries.
        if (ROOT_BINARIES.any { File(it).exists() }) return true

        // 2) The "adb root" giveaway: test-keys build tags.
        if (Build.TAGS != null && Build.TAGS.contains("test-keys")) return true

        // 3) PATH lookup for an `su` binary (cheap, no shell spawn).
        val pathSu = System.getenv("PATH")
            ?.split(":")
            ?.map { "$it/su" }
            ?.any { File(it).exists() }
        if (pathSu == true) return true

        return false
    }

    /** SECURE / EMULATOR / ROOTED — emulator wins because it is the harder ban. */
    fun getDeviceTrustStatus(): DeviceTrust = when {
        isEmulator() -> DeviceTrust.EMULATOR
        isRooted() -> DeviceTrust.ROOTED
        else -> DeviceTrust.SECURE
    }

    /** Convenience for the Profile "Verified Mobile Device" badge. */
    fun isVerifiedMobileDevice(): Boolean = getDeviceTrustStatus() == DeviceTrust.SECURE
}
