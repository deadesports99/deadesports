package com.tourney.player.ui.wallet

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.player.R
import com.tourney.player.ui.theme.DemoColors

/**
 * Port of the demo's `PaymentLogos.tsx`: the overlapping UPI stack in the vault
 * card plus the brand badges the passbook rows use. The brand marks are the
 * same artwork, rasterised from the demo's inline SVGs / public assets.
 */
@Composable
fun UpiStack() {
    val isDark = DemoColors.isDark
    // Demo: ring-1.5 ring-white/30 + border-white/20 (dark) / black/25 + black/15 (light).
    val ring = if (isDark) Color(0x4DFFFFFF) else Color(0x400F172A)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // True overlapping 5-circle stack (24dp circles, 18dp advance => 96dp total width)
        Box(modifier = Modifier.size(width = 96.dp, height = 24.dp)) {
            UpiCircle(R.drawable.brand_phonepe, Color(0xFF5F259F), ring, xOffset = 0.dp, logoSize = 20.dp, pad = 2.dp)
            UpiCircle(R.drawable.brand_gpay, Color.White, ring, xOffset = 18.dp, logoSize = 14.dp)
            // Paytm is a wide wordmark (3.2:1): give it the full inner width so it
            // reads like the demo instead of a tiny speck in the middle.
            // Paytm is a wide wordmark (3.2:1): give it the inner width and start-align
            // it, so the following circle's overlap never eats the last letter.
            UpiCircle(R.drawable.brand_paytm, Color.White, ring, xOffset = 36.dp, logoSize = 20.dp, logoWidth = 16.dp, pad = 2.dp, logoAlignment = Alignment.CenterStart)
            UpiCircle(R.drawable.brand_upi, Color.White, ring, xOffset = 54.dp, logoSize = 16.dp)
            UpiCircle(R.drawable.brand_whatsapp, Color(0xFF25D366), ring, xOffset = 72.dp, logoSize = 14.dp)
        }

        Column(verticalArrangement = Arrangement.Center) {
            Text(
                "Instant UPI",
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                color = if (isDark) Color(0xFFE2E8F0) else Color(0xFF0F172A),
                letterSpacing = 0.5.sp,
                lineHeight = 11.sp,
            )
            Text(
                "All Apps Supported",
                fontSize = 8.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
                letterSpacing = 0.2.sp,
                lineHeight = 10.sp,
                modifier = Modifier.padding(top = 1.dp),
            )
        }
    }
}

/** `24dp` circle positioned with exact horizontal offset inside the stack Box */
@Composable
private fun UpiCircle(
    logo: Int,
    background: Color,
    ring: Color,
    xOffset: androidx.compose.ui.unit.Dp,
    logoSize: androidx.compose.ui.unit.Dp,
    logoWidth: androidx.compose.ui.unit.Dp = logoSize,
    pad: androidx.compose.ui.unit.Dp = 0.dp,
    logoAlignment: Alignment = Alignment.Center,
) {
    Box(
        modifier = Modifier
            .offset(x = xOffset)
            .size(24.dp)
            .shadow(2.dp, CircleShape)
            .clip(CircleShape)
            .background(background)
            .border(1.5.dp, ring, CircleShape)
            .padding(pad),
        contentAlignment = logoAlignment,
    ) {
        Image(
            painter = painterResource(id = logo),
            contentDescription = null,
            // Fit keeps each brand mark's own aspect ratio and centres it, so a
            // wide wordmark (Paytm) and a square icon (PhonePe) both sit true.
            contentScale = ContentScale.Fit,
            modifier = Modifier.size(width = logoWidth, height = logoSize),
        )
    }
}

/** The badge a passbook row shows for its brand/channel. */
enum class BadgeKind { PHONEPE, GPAY, PAYTM, BANK, FF_WIN, FF_ENTRY }

@Composable
fun BrandBadge(kind: BadgeKind) {
    val ring = if (DemoColors.isDark) Color(0x33FFFFFF) else Color(0x1A0F172A)

    when (kind) {
        BadgeKind.PHONEPE -> SquareBadge(bg = Color(0xFF5F259F), ring = ring) {
            Image(
                painterResource(id = R.drawable.brand_phonepe),
                contentDescription = "PhonePe",
                modifier = Modifier.size(24.dp),
            )
        }

        BadgeKind.GPAY -> SquareBadge(bg = Color.White, ring = ring) {
            Image(
                painterResource(id = R.drawable.brand_gpay),
                contentDescription = "Google Pay",
                modifier = Modifier.size(18.dp),
            )
        }

        BadgeKind.PAYTM -> SquareBadge(bg = Color.White, ring = ring) {
            Image(
                painterResource(id = R.drawable.brand_paytm),
                contentDescription = "Paytm",
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(24.dp),
            )
        }

        BadgeKind.BANK -> Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(if (DemoColors.isDark) Color(0xFF1E1B4B) else Color(0xFFEEF2FF))
                .border(1.dp, if (DemoColors.isDark) Color(0x4D6366F1) else Color(0xFFC7D2FE), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.AccountBalance,
                contentDescription = "Bank IMPS",
                tint = if (DemoColors.isDark) Color(0xFF818CF8) else Color(0xFF4338CA),
                modifier = Modifier.size(18.dp),
            )
        }

        BadgeKind.FF_WIN, BadgeKind.FF_ENTRY -> {
            val isWin = kind == BadgeKind.FF_WIN
            val ringColor = if (isWin) {
                if (DemoColors.isDark) Color(0xE6FBBF24) else Color(0xFFF59E0B)
            } else {
                if (DemoColors.isDark) Color(0xCC22D3EE) else Color(0xFF0891B2)
            }
            val chipColor = if (isWin) Color(0xFFFBBF24) else Color(0xFF22D3EE)

            Box(modifier = Modifier.size(32.dp)) {
                Image(
                    painter = painterResource(id = R.drawable.game_freefire),
                    contentDescription = "Free Fire",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.5.dp, ringColor, RoundedCornerShape(12.dp)),
                )

                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = 1.dp, y = 1.dp)
                        .size(14.dp)
                        .clip(CircleShape)
                        .background(chipColor)
                        .border(1.dp, if (DemoColors.isDark) Color(0xFF081326) else Color.White, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isWin) {
                        Icon(
                            Icons.Filled.Star,
                            contentDescription = null,
                            tint = Color(0xFF020617),
                            modifier = Modifier.size(8.dp),
                        )
                    } else {
                        // cyan crossed swords, like the demo's inline combat glyph
                        Canvas(modifier = Modifier.size(8.dp)) {
                            val w = size.width
                            val h = size.height
                            drawLine(
                                color = Color(0xFF020617),
                                start = Offset(w * 0.1f, h * 0.1f),
                                end = Offset(w * 0.9f, h * 0.9f),
                                strokeWidth = w * 0.16f,
                                cap = StrokeCap.Round,
                            )
                            drawLine(
                                color = Color(0xFF020617),
                                start = Offset(w * 0.9f, h * 0.1f),
                                end = Offset(w * 0.1f, h * 0.9f),
                                strokeWidth = w * 0.16f,
                                cap = StrokeCap.Round,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SquareBadge(bg: Color, ring: Color, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, ring, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) { content() }
}
