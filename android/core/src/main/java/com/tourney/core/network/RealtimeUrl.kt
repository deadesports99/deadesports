package com.tourney.core.network

/**
 * WebSocket URL derivation, kept framework-free so it can be unit-tested.
 *
 * Realtime silently doing nothing in production is the worst failure mode we
 * have: slots, room reveals and wallet pushes simply never arrive and nobody
 * notices until a player complains. So the mapping is pinned by tests.
 */
object RealtimeUrl {

    /**
     * `https://api.example.com/api/v1` -> `wss://api.example.com/ws?tenantId=...`
     *
     * Returns `null` when no base URL is configured (a release build that forgot
     * `-PapiBaseUrl`): callers must not attempt a connection to nowhere.
     */
    fun build(baseUrl: String?, tenantId: String, token: String? = null): String? {
        val trimmed = baseUrl?.trim()?.trimEnd('/') ?: return null
        if (trimmed.isEmpty()) return null

        val wsBase = when {
            trimmed.startsWith("https://", ignoreCase = true) ->
                "wss://" + trimmed.substring("https://".length)
            trimmed.startsWith("http://", ignoreCase = true) ->
                "ws://" + trimmed.substring("http://".length)
            trimmed.startsWith("ws://", ignoreCase = true) -> trimmed
            trimmed.startsWith("wss://", ignoreCase = true) -> trimmed
            else -> return null
        }

        // The gateway lives at the host root, not under /api/v1.
        // Keep scheme + host (+port) only: searching for "/api" would also match
        // hosts like "api.thunderesports.in" and strip the whole host.
        val scheme = wsBase.substringBefore("://")
        val hostPort = wsBase.substringAfter("://").substringBefore("/")
        if (hostPort.isBlank()) return null
        val origin = "$scheme://$hostPort"
        val builder = StringBuilder("$origin/ws?tenantId=$tenantId")
        if (!token.isNullOrBlank()) builder.append("&token=").append(token)
        return builder.toString()
    }
}
