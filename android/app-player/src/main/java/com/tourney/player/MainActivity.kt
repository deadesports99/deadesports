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
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.razorpay.Checkout
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import com.tourney.core.datastore.SessionState
import com.tourney.core.fcm.TourneyMessagingService
import com.tourney.core.theme.ClientConfig
import com.tourney.core.theme.ClientTheme
import com.tourney.player.ui.auth.SpartanAuthScreen

/**
 * Player app entry — routes Login/Register vs the main tabbed experience
 * based on the DataStore session (reactively). Also consumes FCM deep links
 * (tap on a push notification jumps straight to Room / Scoreboard).
 */
class MainActivity : ComponentActivity(), PaymentResultWithDataListener {

    /** (pushType, tournamentId) queued from a notification tap. */
    private var pendingPush by mutableStateOf<Pair<String, String>?>(null)

    /** Set once the Compose tree builds the ViewModel; used by the SDK callback. */
    private var playerViewModelRef: PlayerViewModel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleIntent(intent)

        // Razorpay: warm up checkout resources early so the sheet opens fast.
        runCatching { Checkout.preload(applicationContext) }

        val config = ClientConfig.load(applicationContext)

        // Appearance is a persisted preference: read it before the first frame so a
        // Light-mode player never sees a dark flash while DataStore warms up.
        val savedThemeMode =
            com.tourney.core.network.ApiClient.sessionManager.currentThemeMode()

        setContent {
            // Boss demand: in-app Light / Dark switcher (persisted, instant).
            val themeMode by com.tourney.core.network.ApiClient.sessionManager.themeMode
                .collectAsState(initial = savedThemeMode)
            val systemDark = isSystemInDarkTheme()

            // One source of truth: the demo palette follows the in-app switcher so
            // every ported screen flips between the demo's dark and light looks.
            val darkNow = themeMode.isDark(systemDark)
            com.tourney.player.ui.theme.DemoColors.setTheme(darkNow)

            // Status/navigation bar icons must invert with the app theme, otherwise
            // white clock icons sit on the demo's light canvas.
            val rootView = androidx.compose.ui.platform.LocalView.current
            androidx.compose.runtime.SideEffect {
                val window = (rootView.context as? android.app.Activity)?.window ?: return@SideEffect
                val controller = androidx.core.view.WindowCompat.getInsetsController(window, rootView)
                controller.isAppearanceLightStatusBars = !darkNow
                controller.isAppearanceLightNavigationBars = !darkNow
            }

            ClientTheme(config = config, darkTheme = themeMode.isDark(systemDark)) {
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
                playerViewModelRef = playerViewModel
                val session: SessionState by playerViewModel.sessionFlow.collectAsState(initial = SessionState())

                LaunchedEffect(session.userId) {
                    if (session.isLoggedIn) {
                        playerViewModel.prefetchData()
                    }
                }

                if (session.isLoggedIn) {
                    PlayerNavHost(
                        playerViewModel = playerViewModel,
                        themeMode = themeMode,
                        onSetThemeMode = { playerViewModel.setThemeMode(it) },
                        pushTarget = pendingPush,
                        onPushHandled = { pendingPush = null },
                    )
                } else {
                    SpartanAuthScreen(
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

    /**
     * Coming back to the app must never show a stale lobby: the realtime socket
     * may have been suspended in the background, so refresh quietly on resume.
     */
    override fun onResume() {
        super.onResume()
        playerViewModelRef?.onAppResumed()
    }

    private fun handleIntent(intent: Intent?) {
        val type = intent?.getStringExtra(TourneyMessagingService.EXTRA_PUSH_TYPE)
        val tournamentId = intent?.getStringExtra(TourneyMessagingService.EXTRA_TOURNAMENT_ID)
        if (type != null && tournamentId != null) {
            pendingPush = type to tournamentId
        }
    }

    // ─── Razorpay Standard Checkout callbacks ───────────────────────────
    override fun onPaymentSuccess(razorpayPaymentId: String?, paymentData: PaymentData?) {
        val vm = playerViewModelRef ?: return
        val paymentId = razorpayPaymentId ?: paymentData?.paymentId ?: return
        vm.onGatewayPaymentSuccess(paymentId, paymentData?.signature)
    }

    override fun onPaymentError(code: Int, response: String?, paymentData: PaymentData?) {
        // code 0/2 = user cancelled / network; the raw response is gateway JSON.
        val reason = when (code) {
            0 -> "Payment cancelled."
            2 -> "Network error during payment. Try again."
            else -> "Payment failed (code $code). Try again."
        }
        playerViewModelRef?.onGatewayPaymentError(reason)
    }
}