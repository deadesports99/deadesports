package com.tourney.core.ui.auth

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens for the auth flow, lifted 1:1 from the approved demo
 * (`ui-ux demo/finel demo/src/screens/auth/LoginScreen.tsx` + `OtpScreen.tsx`).
 *
 * The palette is intentionally neutral (no neon orbs): near-black canvas, a solid
 * `#0C121E` card, hairline white borders and ONE accent — cyber gold `#FFD000`.
 */
object AuthPalette {
    val Canvas = Color(0xFF050B14)
    val Card = Color(0xFF0C121E)
    val Field = Color(0xFF060B14)
    val FieldFilled = Color(0xFF101826)

    val BorderCard = Color(0x14FFFFFF)   // border-white/[0.08]
    val BorderSoft = Color(0x1AFFFFFF)   // border-white/10
    val BorderStrong = Color(0x26FFFFFF) // border-white/15
    val BorderFaint = Color(0x0DFFFFFF)  // border-white/5

    val Gold = Color(0xFFFFD000)
    val GoldHover = Color(0xFFFFDA29)
    val OnGold = Color(0xFF020617)

    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFFCBD5E1) // slate-300
    val TextMuted = Color(0xFF94A3B8)     // slate-400
    val TextFaint = Color(0xFF64748B)     // slate-500
    val Placeholder = Color(0xFF475569)   // slate-600

    val Danger = Color(0xFFF43F5E)        // rose-500

    val CardRadius = 26.dp
    val FieldRadius = 12.dp
}

/** Fixed 32dp micro-grid + top vignette, exactly like `Ambient.tsx`. */
@Composable
fun AuthAmbient() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AuthPalette.Canvas)
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0x990F172A), Color.Transparent),
                    center = Offset(500f, 0f),
                    radius = 1200f,
                ),
            )
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val step = 32.dp.toPx()
            val line = Color(0x0AFFFFFF)
            var x = 0f
            while (x <= size.width) {
                drawRect(color = line, topLeft = Offset(x, 0f), size = Size(1f, size.height))
                x += step
            }
            var y = 0f
            while (y <= size.height) {
                drawRect(color = line, topLeft = Offset(0f, y), size = Size(size.width, 1f))
                y += step
            }
        }
    }
}

/** Solid architectural card: hairline border, 26dp corners, no gradients. */
@Composable
fun AuthCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(AuthPalette.Card, RoundedCornerShape(AuthPalette.CardRadius))
            .border(1.dp, AuthPalette.BorderCard, RoundedCornerShape(AuthPalette.CardRadius))
            .padding(horizontal = 24.dp, vertical = 24.dp),
    ) {
        content()
    }
}

/** Primary CTA — "Cyber Gold". */
@Composable
fun GoldCta(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    height: Dp = 44.dp,
    trailingIcon: ImageVector? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .background(
                if (loading) AuthPalette.Gold.copy(alpha = 0.75f) else AuthPalette.Gold,
                RoundedCornerShape(AuthPalette.FieldRadius),
            )
            .clickable(enabled = enabled && !loading, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                color = AuthPalette.OnGold,
                strokeWidth = 2.dp,
            )
            Box(Modifier.size(8.dp))
            Text(
                "Verifying...",
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = AuthPalette.OnGold,
            )
        } else {
            Text(
                text,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = AuthPalette.OnGold,
                textAlign = TextAlign.Center,
            )
            if (trailingIcon != null) {
                Box(Modifier.size(7.dp))
                Icon(
                    trailingIcon,
                    contentDescription = null,
                    tint = AuthPalette.OnGold,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

/** Outlined secondary CTA (Google / ghost). */
@Composable
fun GhostCta(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = 40.dp,
    leading: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .background(AuthPalette.Card.copy(alpha = 0.6f), RoundedCornerShape(AuthPalette.FieldRadius))
            .border(1.dp, AuthPalette.BorderSoft, RoundedCornerShape(AuthPalette.FieldRadius))
            .clickable(enabled = enabled, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        leading?.invoke()
        if (leading != null) Box(Modifier.size(9.dp))
        Text(
            text,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = AuthPalette.TextSecondary,
        )
    }
}

/** "or" divider used between phone and Google sign-in. */
@Composable
fun OrDivider() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(AuthPalette.BorderSoft),
        )
        Text("or", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = AuthPalette.TextMuted)
        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(AuthPalette.BorderSoft),
        )
    }
}

/** Trust badge under the card actions (shield + monochrome text). */
@Composable
fun AuthFooter(text: String, icon: ImageVector) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = AuthPalette.TextMuted, modifier = Modifier.size(14.dp))
        Box(Modifier.size(6.dp))
        Text(text, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = AuthPalette.TextMuted)
    }
}
