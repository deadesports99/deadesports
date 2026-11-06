package com.tourney.player.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens lifted 1:1 from the approved demo (`player-web/src/index.css`
 * + the Tailwind classes the cards use). Every ported screen pulls its colours
 * from here so the app and the browser preview cannot drift apart.
 */
object DemoColors {
    /** App canvas — the near-black navy behind everything. */
    val Canvas = Color(0xFF050B14)

    /** Card surface used by match cards, sheets and info blocks. */
    val Card = Color(0xFF0B1526)
    val CardElevated = Color(0xFF0F1E36)

    /** Deepest surface: input fields, inner stat strips. */
    val Field = Color(0xFF060B14)

    val BorderSoft = Color(0x1AFFFFFF)   // white/10
    val BorderStrong = Color(0x26FFFFFF) // white/15
    val BorderFaint = Color(0x0DFFFFFF)  // white/5

    /** The single accent: cyber gold. */
    val Gold = Color(0xFFFFD000)
    val GoldHover = Color(0xFFFFDA29)
    val OnGold = Color(0xFF020617)

    /** Secondary accent used only by the map chip icon + crest. */
    val Cyan = Color(0xFF00C2FF)

    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFFCBD5E1) // slate-300
    val TextMuted = Color(0xFF94A3B8)     // slate-400
    val TextFaint = Color(0xFF64748B)     // slate-500

    val Success = Color(0xFF10B981)
    val Danger = Color(0xFFF43F5E)
    val Warning = Color(0xFFF59E0B)

    /** Ambient glows behind the canvas (top-right cyan, left violet). */
    val GlowCyan = Color(0x3300C2FF)
    val GlowViolet = Color(0x2E7C3AED)
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
