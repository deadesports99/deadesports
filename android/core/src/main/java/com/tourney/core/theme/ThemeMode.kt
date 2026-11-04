package com.tourney.core.theme

/**
 * In-app appearance preference (Boss demand: "Light mode dark mode rakhna").
 *
 * Persisted in DataStore, so the choice survives restarts and applies to both
 * apps the moment it changes (no Activity recreate needed — the theme is read
 * as Compose state).
 */
enum class ThemeMode {
    /** Follow the phone's system setting. */
    SYSTEM,

    /** Deep OLED dark gaming theme. */
    DARK,

    /** Clean "Apple-style" light theme. */
    LIGHT;

    /** Resolve the effective dark flag given the system's current choice. */
    fun isDark(systemInDark: Boolean): Boolean = when (this) {
        SYSTEM -> systemInDark
        DARK -> true
        LIGHT -> false
    }
}
