package com.tourney.admin

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.tourney.core.datastore.SessionState
import com.tourney.core.theme.ThemeMode

/** Admin navigation — dashboard hub + permission-gated consoles (+ owner-only staff console). */
@Composable
fun AdminNavHost(
    viewModel: AdminViewModel,
    themeMode: ThemeMode,
    onSetThemeMode: (ThemeMode) -> Unit,
) {
    val session: SessionState by viewModel.sessionFlow.collectAsState(initial = SessionState())
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "dashboard") {
        composable("dashboard") {
            AdminDashboardScreen(
                session = session,
                viewModel = viewModel,
                onOpenRoute = { route -> navController.navigate(route) },
            )
        }
        composable("create") {
            CreateTournamentScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onCreated = { navController.popBackStack() },
            )
        }
        composable("room") {
            PublishRoomScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }
        composable("scorer") {
            SpectatorScorerScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }
        composable("wallet") {
            AdminWalletScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }
        composable("staff") {
            AdminStaffScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }
        composable("players") {
            AdminPlayersScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onOpenPlayer = { navController.navigate("player_detail") },
                onOpenSuspicious = { navController.navigate("suspicious_players") },
                onOpenDevices = { navController.navigate("device_groups") },
                onOpenWatchlist = { navController.navigate("watchlist") },
            )
        }
        // Phase 12.6 — watchlist: early warning for returning cheaters.
        composable("watchlist") {
            AdminWatchlistScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onOpenDevice = { deviceId ->
                    viewModel.openDeviceGroup(deviceId)
                    navController.navigate("device_group_detail")
                },
            )
        }
        // Phase 12.5 — one phone, many accounts.
        composable("device_groups") {
            AdminDeviceGroupsScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onOpenDevice = { navController.navigate("device_group_detail") },
            )
        }
        composable("device_group_detail") {
            AdminDeviceGroupDetailScreen(
                viewModel = viewModel,
                onBack = {
                    viewModel.closeDeviceGroup()
                    navController.popBackStack()
                },
                onOpenPlayer = { id ->
                    viewModel.clearPlayerDetailFeedback()
                    viewModel.openPlayerDetail(id)
                    navController.navigate("player_detail")
                },
            )
        }
        // Phase 12.4 — cheat radar: accounts ranked by suspicion score.
        composable("suspicious_players") {
            AdminSuspiciousPlayersScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onOpenPlayer = { id ->
                    viewModel.clearPlayerDetailFeedback()
                    viewModel.openPlayerDetail(id)
                    navController.navigate("player_detail")
                },
            )
        }
        // Phase 12.3 — one player in full (history · rewards · cheat signals).
        // The player id lives in the ViewModel, so the route needs no argument.
        composable("player_detail") {
            AdminPlayerDetailScreen(
                viewModel = viewModel,
                onBack = {
                    viewModel.closePlayerDetail()
                    navController.popBackStack()
                },
                onOpenMatch = {
                    viewModel.openRoster(it)
                    navController.navigate("match_roster")
                },
            )
        }
        composable("matches") {
            AdminMatchManagerScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onOpenRoster = { route -> navController.navigate(route) },
            )
        }
        // Phase 12 — match roster (participants · reward · ban). The match id is
        // held by the ViewModel, so this route needs no argument.
        composable("match_roster") {
            AdminMatchRosterScreen(
                viewModel = viewModel,
                onBack = {
                    viewModel.closeRoster()
                    navController.popBackStack()
                },
            )
        }
        composable("settings") {
            AdminSettingsScreen(
                viewModel = viewModel,
                themeMode = themeMode,
                onSetThemeMode = onSetThemeMode,
                onBack = { navController.popBackStack() },
            )
        }
        composable("settlement") {
            AdminSettlementScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
