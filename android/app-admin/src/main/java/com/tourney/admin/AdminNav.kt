package com.tourney.admin

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.tourney.core.datastore.SessionState

/** Admin navigation — dashboard hub + three permission-gated consoles. */
@Composable
fun AdminNavHost(viewModel: AdminViewModel) {
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
    }
}