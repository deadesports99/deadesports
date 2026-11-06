package com.tourney.player

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tourney.core.model.MatchType
import com.tourney.core.theme.ThemeMode
import com.tourney.player.ui.matches.MatchesScreen
import com.tourney.player.ui.nav.DemoBottomBar

/** Bottom tabs — Matches, Wallet and Profile. Push screens hide the bar. */
private enum class PlayerTab(val route: String) {
    MATCHES("feed"),
    WALLET("wallet"),
    PROFILE("profile"),
}

@Composable
fun PlayerNavHost(
    playerViewModel: PlayerViewModel,
    themeMode: ThemeMode,
    onSetThemeMode: (ThemeMode) -> Unit,
    pushTarget: Pair<String, String>? = null,
    onPushHandled: () -> Unit = {},
) {
    val navController = rememberNavController()
    val matchViewModel: MatchViewModel = viewModel()
    val snackbarHostState = remember { SnackbarHostState() }
    var playerNavToast by remember { mutableStateOf<String?>(null) }

    // Small transient messages from the demo-styled screens ("BGMI unlocking…").
    LaunchedEffect(playerNavToast) {
        val message = playerNavToast ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        playerNavToast = null
    }

    // FCM deep-link: jump to the right screen from a notification tap.
    LaunchedEffect(pushTarget) {
        val (type, id) = pushTarget ?: return@LaunchedEffect
        when (type) {
            "ROOM_REVEALED" -> navController.navigate("room/$id")
            "PRIZE_WON" -> navController.navigate("scoreboard/$id")
            else -> navController.navigate(PlayerTab.MATCHES.route) { popUpTo(PlayerTab.MATCHES.route) { inclusive = true } }
        }
        onPushHandled()
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    // Bottom bar only on top-level tabs; push screens (slots/room/scoreboard) hide it.
    val showBottomBar = currentRoute in PlayerTab.entries.map { it.route }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (showBottomBar) {
                DemoBottomBar(currentRoute = currentRoute) { tab ->
                    navController.navigate(tab.route) {
                        popUpTo(PlayerTab.MATCHES.route) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            }
        },
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            NavHost(navController = navController, startDestination = PlayerTab.MATCHES.route) {
                composable(PlayerTab.MATCHES.route) {
                    // Demo design (owner-approved): tournaments page with the
                    // Quick Join bottom sheet; the old feed stays for push links.
                    MatchesScreen(
                        viewModel = playerViewModel,
                        onOpenWallet = { navController.navigate(PlayerTab.WALLET.route) },
                        onOpenRoom = { id -> navController.navigate("room/$id") },
                        onOpenScoreboard = { id -> navController.navigate("scoreboard/$id") },
                        onToast = { message -> playerNavToast = message },
                    )
                }
                composable(PlayerTab.WALLET.route) {
                    com.tourney.player.ui.wallet.WalletScreen(
                        viewModel = playerViewModel,
                        onToast = { message -> playerNavToast = message },
                    )
                }
                composable(PlayerTab.PROFILE.route) {
                    ProfileScreen(
                        viewModel = playerViewModel,
                        themeMode = themeMode,
                        onSetThemeMode = onSetThemeMode,
                        onLogout = {
                            playerViewModel.logout()
                            matchViewModel.resetSession()
                        },
                    )
                }
                composable("slots/{id}/{type}/{fee}") { entry ->
                    val id = entry.arguments?.getString("id") ?: return@composable
                    val type = runCatching { MatchType.valueOf(entry.arguments?.getString("type") ?: "SOLO") }.getOrDefault(MatchType.SOLO)
                    val fee = entry.arguments?.getString("fee") ?: "0"
                    SlotPickerScreen(
                        tournamentId = id,
                        matchType = type,
                        entryFee = fee,
                        viewModel = matchViewModel,
                        onBack = { navController.popBackStack() },
                        onJoinSuccess = { feeAmount ->
                            playerViewModel.deductEntryFee(feeAmount)
                        },
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