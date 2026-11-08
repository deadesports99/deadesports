package com.tourney.player.ui.common

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tourney.player.R

/**
 * The app brand mark — the Spartan lion crest, identical to the web app's
 * `Crest.tsx` so both clients show the same logo.
 *
 * The artwork lives in `drawable-nodpi/brand_logo.png` (transparent PNG cut from
 * the master illustration), drawn with a soft warm glow behind it.
 */
@Composable
fun SpartanCrest(size: Dp = 44.dp) {
    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center,
    ) {
        // Warm amber halo, mirrors the web drop-shadow/glow.
        Box(
            modifier = Modifier
                .size(size)
                .blur(10.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(Color(0x55FF8C00), Color.Transparent),
                    )
                ),
        )

        Image(
            painter = painterResource(id = R.drawable.brand_logo),
            contentDescription = "Spartan Arena",
            contentScale = ContentScale.Fit,
            modifier = Modifier.size(size),
        )
    }
}
