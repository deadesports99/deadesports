package com.tourney.core.model

import com.squareup.moshi.JsonClass

/** Approve/reject admin wallet action — we only surface the message. */
@JsonClass(generateAdapter = true)
data class WalletActionResponse(
    val message: String = "",
)