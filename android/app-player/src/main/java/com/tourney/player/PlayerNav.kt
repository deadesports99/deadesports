package com.tourney.player

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tourney.core.model.MatchType

/** Bottom tabs — Matches and Wallet. Detail screens push on top (back arrow). */
private enum class PlayerTab(val route: String, val label: String, val icon: ImageVector) {
    MATCHES("feed", "Matches", Icons.Filled.SportsEsports),
    WALLET("wallet", "Wallet", Icons.Filled.Wallet),
}

@Composable
fun PlayerNavHost(
    playerViewModel: PlayerViewModel,
) {
    val navController = rememberNavController()
    val matchViewModel: MatchViewModel = viewModel()

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    // Bottom bar only on top-level tabs; push screens (slots/room/scoreboard) hide it.
    val showBottomBar = currentRoute == PlayerTab.MATCHES.route || currentRoute == PlayerTab.WALLET.route

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    PlayerTab.entries.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(PlayerTab.MATCHES.route) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            NavHost(navController = navController, startDestination = PlayerTab.MATCHES.route) {
                composable(PlayerTab.MATCHES.route) {
                    TournamentFeedScreen(
                        viewModel = playerViewModel,
                        onOpenSlots = { id, type -> navController.navigate("slots/$id/$type") },
                        onOpenRoom = { id -> navController.navigate("room/$id") },
                        onOpenScoreboard = { id -> navController.navigate("scoreboard/$id") },
                        onLogout = { playerViewModel.logout() },
                    )
                }
                composable(PlayerTab.WALLET.route) {
                    WalletScreen(viewModel = playerViewModel, onBack = { navController.popBackStack() })
                }
                composable("slots/{id}/{type}") { entry ->
                    val id = entry.arguments?.getString("id") ?: return@composable
                    val type = runCatching { MatchType.valueOf(entry.arguments?.getString("type") ?: "SOLO") }.getOrDefault(MatchType.SOLO)
                    SlotPickerScreen(
                        tournamentId = id,
                        matchType = type,
                        viewModel = matchViewModel,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable("room/{id}") { entry ->
                    val id = entry.arguments?.getString("id") ?: return@composable
                    RoomScreen(
                        tournamentId = id,
                        viewModel = matchViewModel,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable("scoreboard/{id}") { entry ->
                    val id = entry.arguments?.getString("id") ?: return@composable
                    ScoreboardScreen(
                        tournamentId = id,
                        viewModel = matchViewModel,
                        onBack = { navController.popBackStack() },
                    )
                }
            }
        }
    }
}