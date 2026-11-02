package com.tourney.core.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tourney.core.theme.LocalCardShape

/**
 * iOS-style glassmorphic surface: translucent background, subtle border,
 * soft shadow. Cards auto-adopt the client's corner radius via LocalCardShape.
 *
 * @param contentPadding pass `0.dp` for edge-to-edge banners (map artwork).
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 20.dp,
    contentPadding: Dp? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val container = MaterialTheme.colorScheme.surfaceVariant
    val borderColor = MaterialTheme.colorScheme.outline
    val shape = LocalCardShape.current // client-driven radius

    Box(
        modifier = modifier
            .clip(shape)
            .background(container.copy(alpha = 0.6f))
            .border(width = 1.dp, color = borderColor, shape = shape),
    ) {
        Column(modifier = Modifier.padding(contentPadding ?: (cornerRadius * 0.8f)), content = content)
    }
}