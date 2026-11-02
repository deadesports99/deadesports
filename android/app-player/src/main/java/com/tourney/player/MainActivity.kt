package com.tourney.player

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tourney.core.datastore.SessionState
import com.tourney.core.fcm.TourneyMessagingService
import com.tourney.core.theme.ClientConfig
import com.tourney.core.theme.ClientTheme

/**
 * Player app entry — routes Login/Register vs the main tabbed experience
 * based on the DataStore session (reactively). Also consumes FCM deep links
 * (tap on a push notification jumps straight to Room / Scoreboard).
 */
class MainActivity : ComponentActivity() {

    /** (pushType, tournamentId) queued from a notification tap. */
    private var pendingPush by mutableStateOf<Pair<String, String>?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleIntent(intent)

        val config = ClientConfig.load(applicationContext)

        setContent {
            ClientTheme(config = config) {
                // Android 13+ notification permission (high-priority FCM alerts).
                val notifLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission(),
                ) { /* result only matters if denied */ }
                LaunchedEffect(Unit) {
                    if (Build.VERSION.SDK_INT >= 33 &&
                        ContextCompat.checkSelfPermission(this@MainActivity, android.Manifest.permission.POST_NOTIFICATIONS) !=
                        android.content.pm.PackageManager.PERMISSION_GRANTED
                    ) {
                        notifLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                    }
                }

                val playerViewModel: PlayerViewModel = viewModel()
                val session: SessionState by playerViewModel.sessionFlow.collectAsState(initial = SessionState())

                LaunchedEffect(session.userId) {
                    if (session.isLoggedIn) {
                        playerViewModel.prefetchData()
                    }
                }

                if (session.isLoggedIn) {
                    PlayerNavHost(
                        playerViewModel = playerViewModel,
                        pushTarget = pendingPush,
                        onPushHandled = { pendingPush = null },
                    )
                } else {
                    LoginRegisterScreen(
                        viewModel = playerViewModel,
                        onLoggedIn = { /* session flow flips UI automatically */ },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val type = intent?.getStringExtra(TourneyMessagingService.EXTRA_PUSH_TYPE)
        val tournamentId = intent?.getStringExtra(TourneyMessagingService.EXTRA_TOURNAMENT_ID)
        if (type != null && tournamentId != null) {
            pendingPush = type to tournamentId
        }
    }
}