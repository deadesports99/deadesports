package com.tourney.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.tourney.core.model.Role
import com.tourney.core.model.StaffPermissions
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
    val isLoggedIn: Boolean = false,
)

class SessionManager(private val context: Context) {

    /** In-memory copy so OkHttp interceptors can read the token synchronously. */
    @Volatile
    private var cachedToken: String? = null

    /** Synchronous token read for the AuthInterceptor (never suspends). */
    fun currentToken(): String? = cachedToken

    private object Keys {
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val USER_ID = stringPreferencesKey("user_id")
        val TENANT_ID = stringPreferencesKey("tenant_id")
        val ROLE = stringPreferencesKey("role")
        val PERM_CREATE_MATCH = booleanPreferencesKey("perm_can_create_match")
        val PERM_UPDATE_ROOM = booleanPreferencesKey("perm_can_update_room")
        val PERM_DISTRIBUTE_PRIZE = booleanPreferencesKey("perm_can_distribute_prize")
        val PERM_MANAGE_WALLET = booleanPreferencesKey("perm_can_manage_wallet")
    }

    /** Stream of session state — collect in the app for reactive UI. */
    val session: Flow<SessionState> = context.sessionDataStore.data.map { prefs ->
        val roleString = prefs[Keys.ROLE]
        val role = roleString?.let { runCatching { Role.valueOf(it) }.getOrNull() }
        SessionState(
            authToken = prefs[Keys.AUTH_TOKEN],
            userId = prefs[Keys.USER_ID],
            tenantId = prefs[Keys.TENANT_ID],
            role = role,
            permissions = StaffPermissions(
                canCreateMatch = prefs[Keys.PERM_CREATE_MATCH] ?: false,
                canUpdateRoomId = prefs[Keys.PERM_UPDATE_ROOM] ?: false,
                canDistributePrize = prefs[Keys.PERM_DISTRIBUTE_PRIZE] ?: false,
                canManageWallet = prefs[Keys.PERM_MANAGE_WALLET] ?: false,
            ),
            isLoggedIn = prefs[Keys.AUTH_TOKEN] != null,
        )
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
        }
    }

    suspend fun clearSession() {
        cachedToken = null
        context.sessionDataStore.edit { it.clear() }
    }
}