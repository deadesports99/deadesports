package com.tourney.player.ui.nav

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tourney.player.ui.theme.DemoColors
import com.tourney.player.ui.theme.DemoText

/** The three tabs the demo shows at the bottom of every screen. */
enum class DemoTab(val route: String, val label: String, val icon: ImageVector) {
    MATCHES("feed", "Tournaments", Icons.Filled.SportsEsports),
    WALLET("wallet", "Wallet", Icons.Filled.Wallet),
    PROFILE("profile", "Profile", Icons.Filled.Person),
}

/**
 * Demo bottom navigation: dark canvas strip, hairline top border, gold icon for
 * the active tab. Replaces Material's purple NavigationBar so the ported screens
 * keep the approved palette end to end.
 */
@Composable
fun DemoBottomBar(currentRoute: String?, onSelect: (DemoTab) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(DemoColors.Canvas),
    ) {
        HorizontalDivider(thickness = 1.dp, color = DemoColors.BorderSoft)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(62.dp)
                .background(DemoColors.Canvas.copy(alpha = 0.97f)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            DemoTab.entries.forEach { tab ->
                val selected = currentRoute == tab.route
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onSelect(tab) }
                        .padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        tab.icon,
                        contentDescription = tab.label,
                        tint = if (selected) DemoColors.Gold else DemoColors.TextFaint,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        tab.label,
                        fontSize = DemoText.Micro,
                        fontWeight = if (selected) FontWeight.Black else FontWeight.Bold,
                        color = if (selected) DemoColors.TextPrimary else DemoColors.TextFaint,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
            }
        }
    }
}
