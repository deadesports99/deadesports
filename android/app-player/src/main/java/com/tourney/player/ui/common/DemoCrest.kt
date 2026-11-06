package com.tourney.player.ui.common

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The demo's `Crest.tsx`, drawn path-for-path so the brand mark matches the
 * approved design instead of the old emoji badge.
 *
 * viewBox is 64 x 68: shield `#0B192E` + `#38BDF8` stroke, platinum helmet
 * `#E2E8F0`, cyan visor slits `#00D2FF`, gold `#FFD000` plate with the EGA text,
 * plus the soft sky-blue glow bleeding behind it.
 */
@Composable
fun SpartanCrest(size: Dp = 36.dp) {
    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center,
    ) {
        // absolute -inset-1 rounded-full bg-sky-400/20 blur-lg
        Box(
            modifier = Modifier
                .size(size)
                .blur(10.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(Color(0x3338BDF8), Color.Transparent),
                    )
                ),
        )

        Canvas(modifier = Modifier.size(size)) {
            val sx = this.size.width / 64f
            val sy = this.size.height / 68f

            fun p(x: Float, y: Float) = Offset(x * sx, y * sy)

            // 1. Shield
            val shield = Path().apply {
                moveTo(p(32f, 3f).x, p(32f, 3f).y)
                lineTo(p(57f, 13.5f).x, p(57f, 13.5f).y)
                lineTo(p(57f, 33.5f).x, p(57f, 33.5f).y)
                cubicTo(
                    p(57f, 49.5f).x, p(57f, 49.5f).y,
                    p(46.2f, 60.8f).x, p(46.2f, 60.8f).y,
                    p(32f, 65f).x, p(32f, 65f).y,
                )
                cubicTo(
                    p(17.8f, 60.8f).x, p(17.8f, 60.8f).y,
                    p(7f, 49.5f).x, p(7f, 49.5f).y,
                    p(7f, 33.5f).x, p(7f, 33.5f).y,
                )
                lineTo(p(7f, 13.5f).x, p(7f, 13.5f).y)
                close()
            }
            drawPath(shield, color = Color(0xFF0B192E))
            drawPath(shield, color = Color(0xFF38BDF8), style = Stroke(width = 2.5f * sx))

            // 2. Platinum helmet
            val helmet = Path().apply {
                moveTo(p(32f, 14f).x, p(32f, 14f).y)
                cubicTo(
                    p(25.5f, 14f).x, p(25.5f, 14f).y,
                    p(21f, 18.8f).x, p(21f, 18.8f).y,
                    p(21f, 25.5f).x, p(21f, 25.5f).y,
                )
                lineTo(p(21f, 33f).x, p(21f, 33f).y)
                lineTo(p(26.5f, 36.5f).x, p(26.5f, 36.5f).y)
                lineTo(p(28.5f, 30.5f).x, p(28.5f, 30.5f).y)
                lineTo(p(35.5f, 30.5f).x, p(35.5f, 30.5f).y)
                lineTo(p(37.5f, 36.5f).x, p(37.5f, 36.5f).y)
                lineTo(p(43f, 33f).x, p(43f, 33f).y)
                lineTo(p(43f, 25.5f).x, p(43f, 25.5f).y)
                cubicTo(
                    p(43f, 18.8f).x, p(43f, 18.8f).y,
                    p(38.5f, 14f).x, p(38.5f, 14f).y,
                    p(32f, 14f).x, p(32f, 14f).y,
                )
                close()
            }
            drawPath(helmet, color = Color(0xFFE2E8F0))

            // 3. Visor slits
            val leftEye = Path().apply {
                moveTo(p(24.5f, 25.5f).x, p(24.5f, 25.5f).y)
                lineTo(p(30f, 27.5f).x, p(30f, 27.5f).y)
                lineTo(p(29f, 29.5f).x, p(29f, 29.5f).y)
                lineTo(p(24f, 27.5f).x, p(24f, 27.5f).y)
                close()
            }
            val rightEye = Path().apply {
                moveTo(p(39.5f, 25.5f).x, p(39.5f, 25.5f).y)
                lineTo(p(34f, 27.5f).x, p(34f, 27.5f).y)
                lineTo(p(35f, 29.5f).x, p(35f, 29.5f).y)
                lineTo(p(40f, 27.5f).x, p(40f, 27.5f).y)
                close()
            }
            drawPath(leftEye, color = Color(0xFF00D2FF))
            drawPath(rightEye, color = Color(0xFF00D2FF))

            // 4. Gold EGA plate: rect x=10 y=39 w=44 h=12 rx=2.5
            val plateTopLeft = p(10f, 39f)
            val plateSize = Size(44f * sx, 12f * sy)
            val radius = 2.5f * sx
            drawRoundRect(
                color = Color(0xFF091326),
                topLeft = plateTopLeft,
                size = plateSize,
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius, radius),
            )
            drawRoundRect(
                color = Color(0xFFFFD000),
                topLeft = plateTopLeft,
                size = plateSize,
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius, radius),
                style = Stroke(width = 1.5f * sx),
            )

            // 5. The EGA wordmark, centred on x=32 / baseline y=47.5
            val paint = android.graphics.Paint().apply {
                isAntiAlias = true
                color = android.graphics.Color.WHITE
                textSize = 6.5f * sy
                typeface = android.graphics.Typeface.create(
                    android.graphics.Typeface.DEFAULT,
                    android.graphics.Typeface.BOLD,
                )
                letterSpacing = 0.06f
            }
            val textWidth = paint.measureText("EGA")
            drawContext.canvas.nativeCanvas.drawText(
                "EGA",
                p(32f, 0f).x - textWidth / 2f,
                p(0f, 47.5f).y,
                paint,
            )
        }
    }
}
