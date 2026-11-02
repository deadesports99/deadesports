package com.tourney.core.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Slide-to-Confirm join button:
 * - Thumb starts strictly on the left (Alignment.CenterStart) with 4.dp padding.
 * - Entire button is draggable for effortless swiping with zero finger slip.
 * - Dynamic filled track highlights drag progress.
 * - Comfortable 60% threshold triggers long-press haptic + confirm.
 * - Displays loading indicator when [loading] is true.
 */
@Composable
fun SlideToJoinButton(
    text: String,
    enabled: Boolean,
    loading: Boolean = false,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()

    val thumbSize = 50.dp
    val thumbPadding = 4.dp
    val thumbPx = with(density) { thumbSize.toPx() }
    val thumbPaddingPx = with(density) { thumbPadding.toPx() }

    var trackWidthPx by remember { mutableFloatStateOf(0f) }
    val maxOffset = (trackWidthPx - thumbPx - (thumbPaddingPx * 2)).coerceAtLeast(0f)
    val threshold = maxOffset * 0.60f // 60% swipe to confirm

    var dragOffset by remember { mutableFloatStateOf(0f) }
    var isConfirmed by remember { mutableStateOf(false) }

    val primary = MaterialTheme.colorScheme.primary
    val onPrimary = MaterialTheme.colorScheme.onPrimary

    // Shimmer effect for prompt text
    val shimmer = rememberInfiniteTransition(label = "slideShimmer")
    val textAlpha by shimmer.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(800), androidx.compose.animation.core.RepeatMode.Reverse),
        label = "textAlpha",
    )

    val progressFraction = if (maxOffset > 0f) (dragOffset / maxOffset).coerceIn(0f, 1f) else 0f

    val draggableState = rememberDraggableState { delta ->
        if (enabled && !loading && !isConfirmed) {
            val newOffset = (dragOffset + delta).coerceIn(0f, maxOffset)
            if (newOffset >= threshold && dragOffset < threshold) {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            }
            dragOffset = newOffset
        }
    }

    Box(
        modifier = modifier
            .height(58.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(29.dp))
            .background(Color(0xFF1E1E24))
            .onSizeChanged { trackWidthPx = it.width.toFloat() }
            .draggable(
                state = draggableState,
                orientation = Orientation.Horizontal,
                enabled = enabled && !loading,
                onDragStopped = {
                    if (dragOffset >= threshold) {
                        isConfirmed = true
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        scope.launch {
                            // Snap to end
                            dragOffset = maxOffset
                            onConfirm()
                            // Wait briefly before resetting
                            delay(400)
                            val anim = Animatable(dragOffset)
                            anim.animateTo(0f, tween(250, easing = FastOutSlowInEasing)) {
                                dragOffset = this.value
                            }
                            isConfirmed = false
                        }
                    } else {
                        // Snap back to start smoothly
                        scope.launch {
                            val anim = Animatable(dragOffset)
                            anim.animateTo(0f, tween(200, easing = FastOutSlowInEasing)) {
                                dragOffset = this.value
                            }
                        }
                    }
                },
            ),
        contentAlignment = Alignment.CenterStart,
    ) {
        // Dynamic filled track showing swipe progress
        val fillWidthDp = with(density) {
            (thumbPx + (thumbPaddingPx * 2) + dragOffset).toDp()
        }
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .width(fillWidthDp)
                .clip(RoundedCornerShape(29.dp))
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            primary.copy(alpha = 0.25f),
                            primary.copy(alpha = 0.60f),
                        )
                    )
                )
        )

        // Center Shimmer Prompt Text
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            if (loading) {
                Text(
                    text = "Booking Seat...",
                    color = primary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
            } else {
                val labelText = if (progressFraction >= 0.60f) "Release to Join! 🔥" else text
                Text(
                    text = labelText,
                    color = if (progressFraction >= 0.60f) Color.White else primary.copy(alpha = textAlpha),
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    modifier = Modifier.padding(horizontal = 60.dp),
                )
            }
        }

        // Left-Aligned Thumb
        Box(
            modifier = Modifier
                .padding(start = thumbPadding)
                .offset { IntOffset(dragOffset.roundToInt(), 0) }
                .size(thumbSize)
                .clip(CircleShape)
                .background(if (enabled && !loading) primary else Color.DarkGray),
            contentAlignment = Alignment.Center,
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = onPrimary,
                    strokeWidth = 2.5.dp,
                )
            } else {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = "Slide Arrow",
                    tint = onPrimary,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
    }
}
