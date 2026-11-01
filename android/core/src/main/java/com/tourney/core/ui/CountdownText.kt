package com.tourney.core.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import kotlinx.coroutines.delay

/**
 * Live countdown "MM:SS" (auto-extends to H:MM:SS). Ticks every second while
 * [remainingSeconds] > 0. Used by the timed room reveal (T-15 min lock).
 */
@Composable
fun CountdownText(
    remainingSeconds: Long,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
    fontSize: TextUnit = MaterialTheme.typography.headlineMedium.fontSize,
) {
    var secondsLeft by remember { mutableLongStateOf(remainingSeconds) }

    LaunchedEffect(remainingSeconds) {
        secondsLeft = remainingSeconds
        while (secondsLeft > 0) {
            delay(1000L)
            secondsLeft = (secondsLeft - 1).coerceAtLeast(0)
        }
    }

    Text(
        text = formatCountdown(secondsLeft),
        color = color,
        fontSize = fontSize,
        fontWeight = FontWeight.Bold,
        modifier = modifier,
    )
}

fun formatCountdown(totalSeconds: Long): String {
    val s = totalSeconds.coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    val sec = s % 60
    val mm = m.toString().padStart(2, '0')
    val ss = sec.toString().padStart(2, '0')
    return if (h > 0) "$h:$mm:$ss" else "$mm:$ss"
}