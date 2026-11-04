package com.tourney.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.tourney.core.model.Role
import com.tourney.core.model.StaffPermissions
import com.tourney.core.theme.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.sessionDataStore by preferencesDataStore(name = "tourney_session")

/**
 * Offline session: JWT + role + permission flags cached on-device so the
 * dashboard renders instantly (zero-delay) after cold start — the boss demand
 * for the dynamic ADMIN/SUB_ADMIN dashboards.
 */
data class SessionState(
    val authToken: String? = null,
    val userId: String? = null,
    val tenantId: String? = null,
    val role: Role? = null,
    val permissions: StaffPermissions = StaffPermissions.NONE,
    val inGameName: String? = null,
    val inGameUid: String? = null,
    val isLoggedIn: Boolean = false,
)

class SessionManager(private val context: Context) {

    /** In-memory copy so OkHttp interceptors can read the token synchronously. */
    @Volatile
    private var cachedToken: String? = null

    /** Synchronous token read for the AuthInterceptor (never suspends). */
    fun currentToken(): String? {
        if (cachedToken == null) {
            runCatching {
                kotlinx.coroutines.runBlocking {
                    val prefs = context.sessionDataStore.data.first()
                    cachedToken = prefs[Keys.AUTH_TOKEN]
                }
            }
        }
        return cachedToken
    }

    private object Keys {
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val USER_ID = stringPreferencesKey("user_id")
        val TENANT_ID = stringPreferencesKey("tenant_id")
        val ROLE = stringPreferencesKey("role")
        val IN_GAME_NAME = stringPreferencesKey("in_game_name")
        val IN_GAME_UID = stringPreferencesKey("in_game_uid")
        val FCM_TOKEN = stringPreferencesKey("fcm_token")
        val PERM_CREATE_MATCH = booleanPreferencesKey("perm_can_create_match")
        val PERM_UPDATE_ROOM = booleanPreferencesKey("perm_can_update_room")
        val PERM_DISTRIBUTE_PRIZE = booleanPreferencesKey("perm_can_distribute_prize")
        val PERM_MANAGE_WALLET = booleanPreferencesKey("perm_can_manage_wallet")
        val THEME_MODE = stringPreferencesKey("theme_mode")
    }

    /** Stream of session state — collect in the app for reactive UI. */
    val session: Flow<SessionState> = context.sessionDataStore.data.map { prefs ->
        val roleString = prefs[Keys.ROLE]
        val role = roleString?.let { runCatching { Role.valueOf(it) }.getOrNull() }
        val token = prefs[Keys.AUTH_TOKEN]
        cachedToken = token
        SessionState(
            authToken = token,
            userId = prefs[Keys.USER_ID],
            tenantId = prefs[Keys.TENANT_ID],
            role = role,
            permissions = StaffPermissions(
                canCreateMatch = prefs[Keys.PERM_CREATE_MATCH] ?: false,
                canUpdateRoomId = prefs[Keys.PERM_UPDATE_ROOM] ?: false,
                canDistributePrize = prefs[Keys.PERM_DISTRIBUTE_PRIZE] ?: false,
                canManageWallet = prefs[Keys.PERM_MANAGE_WALLET] ?: false,
            ),
            inGameName = prefs[Keys.IN_GAME_NAME],
            inGameUid = prefs[Keys.IN_GAME_UID],
            isLoggedIn = token != null,
        )
    }

    // ─── Appearance (Light / Dark / System) ────────────────────────────
    /**
     * Persisted appearance preference. Defaults to [ThemeMode.DARK] because
     * the platform is an OLED gaming app — the client started dark.
     */
    val themeMode: Flow<ThemeMode> = context.sessionDataStore.data.map { prefs ->
        prefs[Keys.THEME_MODE]?.let { raw -> runCatching { ThemeMode.valueOf(raw) }.getOrNull() }
            ?: ThemeMode.DARK
    }

    /** Read the saved mode synchronously (first frame, before the flow emits). */
    fun currentThemeMode(): ThemeMode = runCatching {
        kotlinx.coroutines.runBlocking {
            themeMode.first()
        }
    }.getOrDefault(ThemeMode.DARK)

    suspend fun saveThemeMode(mode: ThemeMode) {
        context.sessionDataStore.edit { prefs -> prefs[Keys.THEME_MODE] = mode.name }
    }

    /** One-shot read (e.g. setup interceptors before UI starts). */
    suspend fun current(): SessionState = session.first()

    /** Persist the full login payload. */
    suspend fun saveSession(
        authToken: String,
        userId: String,
        tenantId: String,
        role: Role,
        permissions: StaffPermissions,
        inGameName: String? = null,
        inGameUid: String? = null,
    ) {
        cachedToken = authToken
        context.sessionDataStore.edit { prefs ->
            prefs[Keys.AUTH_TOKEN] = authToken
            prefs[Keys.USER_ID] = userId
            prefs[Keys.TENANT_ID] = tenantId
            prefs[Keys.ROLE] = role.name
            prefs[Keys.PERM_CREATE_MATCH] = permissions.canCreateMatch
            prefs[Keys.PERM_UPDATE_ROOM] = permissions.canUpdateRoomId
            prefs[Keys.PERM_DISTRIBUTE_PRIZE] = permissions.canDistributePrize
            prefs[Keys.PERM_MANAGE_WALLET] = permissions.canManageWallet
            if (inGameName != null) prefs[Keys.IN_GAME_NAME] = inGameName
            if (inGameUid != null) prefs[Keys.IN_GAME_UID] = inGameUid
        }
    }

    /** Update cached In-Game profile. */
    suspend fun saveGameProfile(inGameName: String, inGameUid: String) {
        context.sessionDataStore.edit { prefs ->
            prefs[Keys.IN_GAME_NAME] = inGameName
            prefs[Keys.IN_GAME_UID] = inGameUid
        }
    }

    suspend fun clearSession() {
        cachedToken = null
        // Keep the appearance preference — logging out must not flash dark->light.
        val keepTheme = runCatching { themeMode.first() }.getOrDefault(ThemeMode.DARK)
        context.sessionDataStore.edit { prefs ->
            prefs.clear()
            prefs[Keys.THEME_MODE] = keepTheme.name
        }
    }

    fun clearSessionSync() {
        cachedToken = null
        runCatching {
            kotlinx.coroutines.runBlocking {
                val keepTheme = themeMode.first()
                context.sessionDataStore.edit { prefs ->
                    prefs.clear()
                    prefs[Keys.THEME_MODE] = keepTheme.name
                }
            }
        }
    }

    // ─── FCM push token (registered on onNewToken, synced to backend) ─────
    suspend fun saveFcmToken(token: String) {
        context.sessionDataStore.edit { prefs -> prefs[Keys.FCM_TOKEN] = token }
    }

    suspend fun fcmToken(): String? = context.sessionDataStore.data.first()[Keys.FCM_TOKEN]
}
