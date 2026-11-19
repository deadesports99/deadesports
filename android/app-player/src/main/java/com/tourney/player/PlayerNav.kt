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
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tourney.core.model.MatchType
import com.tourney.core.theme.ThemeMode
import androidx.compose.runtime.collectAsState
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.tourney.player.ui.matches.JoinedPlayersScreen
import com.tourney.player.ui.matches.MatchStatusScreen
import com.tourney.player.ui.matches.MatchesScreen
import com.tourney.player.ui.matches.MyMatchesScreen
import com.tourney.player.ui.nav.DemoBottomBar

/** Bottom tabs — Matches, My Matches, Wallet and Profile. Push screens hide the bar. */
private enum class PlayerTab(val route: String) {
    MATCHES("feed"),
    MY_MATCHES("my-matches"),
    WALLET("wallet"),
    SETTINGS("settings"),
}

/**
 * One way to switch top-level tabs, used by the bottom bar and by every
 * "open wallet" shortcut, so a tab can never sit twice on the back stack.
 *
 * `saveState/restoreState` is deliberately OFF: saving the stack under the start
 * destination made the next tab tap restore the screen we just left (the wallet
 * pill bug — tap Tournaments, keep seeing Wallet until Back). Every screen keeps
 * its data in a ViewModel, so dropping navigation state loses nothing visible.
 */
private fun NavHostController.switchTab(route: String) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { inclusive = false }
        launchSingleTop = true
    }
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
    // Own player id, so the scoreboard can pull "your" row out of the table.
    val sessionUserId by playerViewModel.sessionFlow.collectAsState(
        initial = com.tourney.core.datastore.SessionState(),
    )
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
            "PRIZE_WON" -> navController.navigate(PlayerTab.MY_MATCHES.route) { popUpTo(PlayerTab.MATCHES.route) { inclusive = true } }
            else -> navController.navigate(PlayerTab.MATCHES.route) { popUpTo(PlayerTab.MATCHES.route) { inclusive = true } }
        }
        onPushHandled()
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    // Bottom bar only on top-level tabs; push screens (slots/room) hide it.
    val showBottomBar = currentRoute in PlayerTab.entries.map { it.route }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (showBottomBar) {
                DemoBottomBar(currentRoute = currentRoute) { tab ->
                    navController.switchTab(tab.route)
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
                        onOpenWallet = { navController.switchTab(PlayerTab.WALLET.route) },
                        onOpenRoom = { id -> navController.navigate("room/$id") },
                        onOpenPlayers = { id -> navController.navigate("players/$id") },
                        onOpenStatus = { id, number ->
                            navController.navigate("status/$id?n=${number ?: -1}")
                        },
                        onToast = { message -> playerNavToast = message },
                    )
                }
                composable(PlayerTab.MY_MATCHES.route) {
                    MyMatchesScreen(
                        viewModel = playerViewModel,
                        onOpenWallet = { navController.switchTab(PlayerTab.WALLET.route) },
                        onOpenRoom = { id -> navController.navigate("room/$id") },
                        onOpenStatus = { id, number ->
                            navController.navigate("status/$id?n=${number ?: -1}")
                        },
                        onBrowseTournaments = { navController.switchTab(PlayerTab.MATCHES.route) },
                    )
                }
                composable(PlayerTab.WALLET.route) {
                    // Money moves while this tab is closed (prize paid, seat
                    // refunded, deposit approved). Ask the server on every open
                    // instead of rendering a stale cached balance.
                    LaunchedEffect(Unit) { playerViewModel.refreshWallet(silent = true) }
                    com.tourney.player.ui.wallet.WalletScreen(
                        viewModel = playerViewModel,
                        onToast = { message -> playerNavToast = message },
                    )
                }
                composable(PlayerTab.SETTINGS.route) {
                    com.tourney.player.ui.settings.SettingsScreen(
                        viewModel = playerViewModel,
                        themeMode = themeMode,
                        onSetThemeMode = onSetThemeMode,
                        onSignOut = {
                            playerViewModel.logout()
                            matchViewModel.resetSession()
                        },
                        onToast = { message -> playerNavToast = message },
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
                composable("players/{id}") { entry ->
                    val id = entry.arguments?.getString("id") ?: return@composable
                    val feed = (playerViewModel.feedUi as? UiState.Success)?.data?.items.orEmpty()
                    JoinedPlayersScreen(
                        tournamentId = id,
                        matchTitle = feed.firstOrNull { it.id == id }?.title,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable(
                    route = "status/{id}?n={n}",
                    arguments = listOf(navArgument("n") { defaultValue = "-1" }),
                ) { entry ->
                    val id = entry.arguments?.getString("id") ?: return@composable
                    val number = entry.arguments?.getString("n")?.toIntOrNull()?.takeIf { it > 0 }
                    MatchStatusScreen(
                        tournamentId = id,
                        myUserId = sessionUserId.userId,
                        onBack = { navController.popBackStack() },
                        matchNumberHint = number,
                    )
                }
                composable("room/{id}") { entry ->
                    val id = entry.arguments?.getString("id") ?: return@composable
                    // Room page shows WHICH match the code belongs to. The feed row
                    // is only a hint (instant strip); RoomScreen fetches the match
                    // itself for push deep links that arrive cold.
                    val feed = (playerViewModel.feedUi as? UiState.Success)?.data?.items.orEmpty()
                    val tournament = feed.firstOrNull { it.id == id }
                    RoomScreen(
                        tournamentId = id,
                        viewModel = matchViewModel,
                        onBack = { navController.popBackStack() },
                        tournament = tournament,
                    )
                }
            }
        }
    }
}