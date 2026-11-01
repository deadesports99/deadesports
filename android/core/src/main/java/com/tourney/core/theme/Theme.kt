package com.tourney.core.theme

import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// ─── CompositionLocals — every composable can read client identity/shapes ───

val LocalClientConfig = staticCompositionLocalOf { ClientConfig.DEFAULT }

/** Shape profile controlled by cornerRadiusDp (Sharp 4 / Rounded 12 / Pill 999). */
val LocalCardShape = staticCompositionLocalOf<CornerBasedShape> { RoundedCornerShape(12.dp) }
val LocalButtonShape = staticCompositionLocalOf<CornerBasedShape> { RoundedCornerShape(12.dp) }

private fun parseHex(hex: String, fallback: Color): Color = try {
    Color(android.graphics.Color.parseColor(hex.trim()))
} catch (e: IllegalArgumentException) {
    fallback
}

/** Map the config's font token to a Compose FontFamily. */
private fun fontFamilyFor(style: String): FontFamily = when (style.lowercase()) {
    "rajdhani" -> FontFamily.SansSerif   // bundled TTF assets land here in Phase 2
    "orbitron" -> FontFamily.SansSerif
    "poppins" -> FontFamily.SansSerif
    "inter" -> FontFamily.SansSerif
    "monospace" -> FontFamily.Monospace
    else -> FontFamily.Default
}

/**
 * Dynamic Material 3 theme, fully tokenized from ClientConfig.
 * - Clean "Apple-style" light scheme
 * - OLED-friendly deep dark scheme (config-driven)
 */
@Composable
fun ClientTheme(
    config: ClientConfig = LocalClientConfig.current,
    darkTheme: Boolean = config.enableDarkMode,
    content: @Composable () -> Unit,
) {
    val primary = parseHex(config.primaryColorHex, Color(0xFFFF5722))
    val button = parseHex(config.buttonColorHex, Color(0xFFFF7043))
    val accent = parseHex(config.accentColorHex, Color(0xFFFFB300))

    val lightScheme = lightColorScheme(
        primary = primary,
        onPrimary = Color.White,
        primaryContainer = primary.copy(alpha = 0.15f),
        onPrimaryContainer = primary,
        secondary = button,
        onSecondary = Color.White,
        tertiary = accent,
        onTertiary = Color.Black,
        background = Color(0xFFF7F7FA),
        onBackground = Color(0xFF101014),
        surface = Color(0xFFFFFFFF),
        onSurface = Color(0xFF101014),
        surfaceVariant = Color(0xFFF0F0F4),
        onSurfaceVariant = Color(0xFF52525E),
        outline = Color(0xFF2C2C31).copy(alpha = 0.2f),
    )

    val darkScheme = darkColorScheme(
        primary = primary,
        onPrimary = Color.White,
        primaryContainer = primary.copy(alpha = 0.22f),
        onPrimaryContainer = primary,
        secondary = button,
        onSecondary = Color.White,
        tertiary = accent,
        onTertiary = Color.Black,
        background = Color(0xFF0A0A0D),     // OLED-ish deep black
        onBackground = Color(0xFFE8E8EE),
        surface = Color(0xFF121216),
        onSurface = Color(0xFFE8E8EE),
        surfaceVariant = Color(0xFF1C1C22),
        onSurfaceVariant = Color(0xFF9D9DA8),
        outline = Color(0xFFFFFFFF).copy(alpha = 0.12f),
    )

    val radius = config.cornerRadius
    val shapes = Shapes(
        extraSmall = RoundedCornerShape(radius * 0.25f),
        small = RoundedCornerShape(radius * 0.5f),
        medium = RoundedCornerShape(radius),
        large = RoundedCornerShape(radius * 1.5f),
        extraLarge = RoundedCornerShape(radius * 2f),
    )

    CompositionLocalProvider(
        LocalClientConfig provides config,
        LocalCardShape provides shapes.medium,
        LocalButtonShape provides shapes.medium,
    ) {
        MaterialTheme(
            colorScheme = if (darkTheme) darkScheme else lightScheme,
            typography = MaterialTheme.typography.copy(
                headlineLarge = MaterialTheme.typography.headlineLarge.copy(
                    fontFamily = fontFamilyFor(config.fontStyle),
                    fontWeight = FontWeight.Bold,
                ),
                titleLarge = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = fontFamilyFor(config.fontStyle),
                    fontWeight = FontWeight.SemiBold,
                ),
                labelLarge = MaterialTheme.typography.labelLarge.copy(
                    fontFamily = fontFamilyFor(config.fontStyle),
                    fontWeight = FontWeight.SemiBold,
                ),
            ),
            shapes = shapes,
            content = content,
        )
    }
}