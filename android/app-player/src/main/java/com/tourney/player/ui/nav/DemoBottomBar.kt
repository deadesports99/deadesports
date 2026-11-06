package com.tourney.player.ui.nav

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.player.ui.theme.DemoColors

private val DemoRadiusPill: RoundedCornerShape = RoundedCornerShape(percent = 50)

/** The three tabs the demo shows at the bottom of every screen. */
enum class DemoTab(val route: String, val label: String, val icon: ImageVector) {
    MATCHES("feed", "Tournaments", Icons.Filled.SportsEsports),
    WALLET("wallet", "Wallet", Icons.Filled.Wallet),
    PROFILE("profile", "Profile", Icons.Filled.Person),
}

/**
 * 1:1 port of the demo's `BottomNav`:
 * - nav strip: `border-t border-white/10`, `bg-slate-950/90`, `px-4 pb-3 pt-2`
 * - each tab: `flex-1 flex-col items-center gap-1 py-1 active:scale-95`
 * - active pill: `h-8 w-14 rounded-full bg-white/15 text-white`, icon `scale-105`
 * - inactive: transparent pill, `text-slate-400`
 * - label: `text-[10px]`, active `font-black text-white`, inactive `font-medium text-slate-400`
 */
@Composable
fun DemoBottomBar(currentRoute: String?, onSelect: (DemoTab) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(DemoColors.Canvas.copy(alpha = 0.90f)),
    ) {
        // border-t border-white/10
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(DemoColors.BorderSoft),
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(top = 8.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            DemoTab.entries.forEach { tab ->
                val selected = currentRoute == tab.route
                val iconScale by animateFloatAsState(
                    targetValue = if (selected) 1.05f else 1f,
                    label = "navIconScale",
                )

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onSelect(tab) }
                        .padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    // Native M3 style active indicator pill (icon only)
                    Box(
                        modifier = Modifier
                            .width(56.dp)
                            .height(32.dp)
                            .clip(DemoRadiusPill)
                            .background(if (selected) DemoColors.BorderStrong else Color.Transparent),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            tab.icon,
                            contentDescription = tab.label,
                            tint = if (selected) DemoColors.TextPrimary else DemoColors.TextMuted,
                            modifier = Modifier
                                .size(20.dp)
                                .scale(iconScale),
                        )
                    }

                    Text(
                        tab.label,
                        fontSize = 10.sp,
                        fontWeight = if (selected) FontWeight.Black else FontWeight.Medium,
                        color = if (selected) DemoColors.TextPrimary else DemoColors.TextMuted,
                        letterSpacing = (-0.2).sp,
                    )
                }
            }
        }
    }
}

