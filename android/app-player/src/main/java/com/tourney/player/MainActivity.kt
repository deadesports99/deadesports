package com.tourney.player

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
 * Player app entry — routes Login/Register vs the main tabbed experience
 * based on the DataStore session (reactively).
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val config = ClientConfig.load(applicationContext)

        setContent {
            ClientTheme(config = config) {
                val playerViewModel: PlayerViewModel = viewModel()
                val session: SessionState by playerViewModel.sessionFlow.collectAsState(initial = SessionState())

                if (session.isLoggedIn) {
                    PlayerNavHost(playerViewModel = playerViewModel)
                } else {
                    LoginRegisterScreen(
                        viewModel = playerViewModel,
                        onLoggedIn = { /* session flow flips UI automatically */ },
                    )
                }
            }
        }
    }
}