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
            )
        }
        composable("matches") {
            AdminMatchManagerScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
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
