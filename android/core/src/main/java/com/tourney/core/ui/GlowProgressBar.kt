package com.tourney.core.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Slot-progress bar with an esports glow. When the match is near full
 * (>= 40/48 seats), the bar pulses warm-red to signal urgency.
 */
@Composable
fun GlowProgressBar(
    progress: Float,
    nearFull: Boolean,
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "glowProgress")
    val pulse by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(600), RepeatMode.Reverse),
        label = "glowPulse",
    )

    val trackColor = if (nearFull) Color(0xFFFF6B35) else MaterialTheme.colorScheme.primary
    val glowColor = if (nearFull) Color(0xFFE53935) else MaterialTheme.colorScheme.tertiary

    Box(modifier = modifier.fillMaxWidth()) {
        // Glow halo (visible + pulsing only when near full).
        if (nearFull) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(18.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(glowColor.copy(alpha = 0.15f * pulse), glowColor.copy(alpha = 0.05f * pulse)),
                        )
                    )
                    .alpha(pulse),
            )
        }
        LinearProgressIndicator(
            progress = { progress.coerceIn(0f, 1f) },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = trackColor,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}