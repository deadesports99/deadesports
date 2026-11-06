package com.tourney.player.ui.theme

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens lifted 1:1 from the approved demo (`player-web/src/index.css`
 * + the Tailwind classes the cards use). Every ported screen pulls its colours
 * from here so the app and the browser preview cannot drift apart.
 */
object DemoColors {
    /**
     * Demo `theme === 'dark'` flag. Screens read the colours below as getters, so
     * flipping this recomposes every surface exactly like the demo's Tailwind
     * classes do (dark: slate-950 canvas + #0B1526 cards, light: #F8FAFC canvas +
     * white cards, slate-950 text, slate-200 borders).
     */
    var isDark by mutableStateOf(true)
        private set

    fun setTheme(dark: Boolean) {
        isDark = dark
    }

    /** App canvas — near-black navy in dark, slate-50 in light. */
    val Canvas: Color get() = if (isDark) Color(0xFF050B14) else Color(0xFFF8FAFC)

    /** Card surface used by match cards, sheets and info blocks. */
    val Card: Color get() = if (isDark) Color(0xFF0B1526) else Color(0xFFFFFFFF)
    val CardElevated: Color get() = if (isDark) Color(0xFF0F1E36) else Color(0xFFFFFFFF)

    /** Muted surface (dimmed chips, inner strips): dark card vs slate-100. */
    val CardMuted: Color get() = if (isDark) Color(0xFF0B1526) else Color(0xFFF1F5F9)

    /** Inner stat strip inside a card: slate-900/75 in dark, slate-50 in light. */
    val Strip: Color get() = if (isDark) Color(0xBF0F172A) else Color(0xFFF8FAFC)

    /** Small chips/map tags: slate-800/80 in dark, slate-100 in light. */
    val ChipBg: Color get() = if (isDark) Color(0xCC1E293B) else Color(0xFFF1F5F9)

    /** Progress track: slate-800 in dark, slate-200 in light. */
    val Track: Color get() = if (isDark) Color(0xFF1E293B) else Color(0xFFE2E8F0)

    /** Deepest surface: input fields, inner stat strips. */
    val Field: Color get() = if (isDark) Color(0xFF060B14) else Color(0xFFF8FAFC)

    val BorderSoft: Color get() = if (isDark) Color(0x1AFFFFFF) else Color(0x1A0F172A)   // white/10 : slate-900/10
    val BorderStrong: Color get() = if (isDark) Color(0x26FFFFFF) else Color(0x330F172A) // white/15 : slate-300
    val BorderFaint: Color get() = if (isDark) Color(0x0DFFFFFF) else Color(0x0D0F172A)  // white/5 : slate-900/5

    /** The single accent: cyber gold (identical in both themes, like the demo). */
    val Gold: Color = Color(0xFFFFD000)
    val GoldHover: Color = Color(0xFFFFDA29)
    val OnGold: Color = Color(0xFF020617)

    /** Secondary accent used only by the map chip icon + crest. */
    val Cyan: Color = Color(0xFF00C2FF)

    val TextPrimary: Color get() = if (isDark) Color(0xFFFFFFFF) else Color(0xFF020617) // white : slate-950
    val TextSecondary: Color get() = if (isDark) Color(0xFFCBD5E1) else Color(0xFF334155) // slate-300 : slate-700
    val TextMuted: Color get() = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)     // slate-400 : slate-500
    val TextFaint: Color get() = if (isDark) Color(0xFF64748B) else Color(0xFF94A3B8)     // slate-500 : slate-400

    val Success: Color get() = if (isDark) Color(0xFF10B981) else Color(0xFF059669)
    val Danger: Color get() = if (isDark) Color(0xFFF43F5E) else Color(0xFFE11D48)
    val Warning: Color get() = if (isDark) Color(0xFFF59E0B) else Color(0xFFD97706)

    /** Ambient glows behind the canvas (top-right cyan, left violet). */
    val GlowCyan: Color get() = if (isDark) Color(0x3300C2FF) else Color(0x1F38BDF8)
    val GlowViolet: Color get() = if (isDark) Color(0x2E7C3AED) else Color(0x1F8B5CF6)
}

object DemoRadius {
    val Card = 16.dp      // rounded-2xl
    val Sheet = 28.dp     // rounded-t-[28px]
    val Field = 12.dp     // rounded-xl
    val Pill = 999.dp
}

/**
 * Lovable text sizes in sp — the demo is built on Tailwind's arbitrary px scale.
 * Keeping them as named constants stops random 11/12/13 values creeping in.
 */
object DemoText {
    val Micro = 9.sp      // stat labels
    val Tiny = 10.sp      // chips, helper text
    val Small = 11.sp
    val Body = 12.sp
    val BodyStrong = 13.sp
    val Title = 15.sp
}
