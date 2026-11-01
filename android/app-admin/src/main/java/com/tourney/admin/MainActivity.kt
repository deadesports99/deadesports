package com.tourney.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tourney.core.datastore.SessionState
import com.tourney.core.theme.ClientConfig
import com.tourney.core.theme.ClientTheme

/**
 * Admin app entry — Owner/Staff login, then the permission-driven dashboard.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val config = ClientConfig.load(applicationContext)

        setContent {
            ClientTheme(config = config) {
                val adminViewModel: AdminViewModel = viewModel()
                val session: SessionState by adminViewModel.sessionFlow.collectAsState(initial = SessionState())

                if (session.isLoggedIn) {
                    AdminNavHost(viewModel = adminViewModel)
                } else {
                    AdminLoginScreen(viewModel = adminViewModel)
                }
            }
        }
    }
}