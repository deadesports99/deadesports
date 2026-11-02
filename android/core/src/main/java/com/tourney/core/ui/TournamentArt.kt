package com.tourney.core.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tourney.core.R
import com.tourney.core.model.GameMode
import com.tourney.core.model.MapType

/**
 * 🔥 HIGH-RES FREE FIRE ART LIBRARY
 *
 * Single mapping between the backend enums (`MapType`, `GameMode`) and the
 * official Garena artwork shipped in `:core/res/drawable`. No screen should
 * ever hardcode a drawable id — add a new map/badge here only.
 */
object TournamentArt {

    /** Official map overview artwork per map. */
    @DrawableRes
    fun mapArt(mapType: MapType): Int = when (mapType) {
        MapType.BERMUDA -> R.drawable.ff_map_bermuda
        MapType.PURGATORY -> R.drawable.ff_map_purgatory
        MapType.KALAHARI -> R.drawable.ff_map_kalahari
        MapType.ALPINE -> R.drawable.ff_map_alpine
        MapType.NEXTERRA -> R.drawable.ff_map_nexterra
    }

    /** Mode splash / badge artwork (Clash Squad 4v4 vs Ranked Battle Royale). */
    @DrawableRes
    fun modeBadge(gameMode: GameMode): Int = when (gameMode) {
        GameMode.CLASH_SQUAD -> R.drawable.ff_mode_clash_squad
        GameMode.BATTLE_ROYALE -> R.drawable.ff_mode_battle_royale
    }

    /** In-game currency micro-icons (wallet balance cards). */
    @DrawableRes
    val diamond: Int = R.drawable.ff_icon_diamond

    @DrawableRes
    val goldCoin: Int = R.drawable.ff_icon_gold_coin

    @DrawableRes
    val brandBadge: Int = R.drawable.ff_badge_round

    /** Human name used next to the art (Free Fire community naming). */
    fun mapLabel(mapType: MapType): String = when (mapType) {
        MapType.BERMUDA -> "Bermuda"
        MapType.PURGATORY -> "Purgatory"
        MapType.KALAHARI -> "Kalahari"
        MapType.ALPINE -> "Alpine"
        MapType.NEXTERRA -> "NeXTerra"
    }

    fun modeLabel(gameMode: GameMode): String = when (gameMode) {
        GameMode.CLASH_SQUAD -> "Clash Squad"
        GameMode.BATTLE_ROYALE -> "Battle Royale"
    }
}

/**
 * Edge-to-edge map banner used by tournament cards: cropped official artwork
 * with a dark scrim so overlay text stays readable in light themes.
 */
@Composable
fun MapBanner(
    mapType: MapType,
    modifier: Modifier = Modifier,
    height: Dp = 118.dp,
    overlay: (@Composable BoxScope.() -> Unit)? = null,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height),
    ) {
        Image(
            painter = painterResource(id = TournamentArt.mapArt(mapType)),
            contentDescription = "${TournamentArt.mapLabel(mapType)} map",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        // Scrim: dark top (status badge) + dark bottom (map/mode labels).
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.40f),
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.75f),
                        ),
                    ),
                ),
        )
        if (overlay != null) {
            overlay()
        }
    }
}

/** Small rounded mode splash thumbnail (Clash Squad / Ranked BR). */
@Composable
fun ModeBadge(
    gameMode: GameMode,
    modifier: Modifier = Modifier,
    size: Dp = 34.dp,
) {
    Image(
        painter = painterResource(id = TournamentArt.modeBadge(gameMode)),
        contentDescription = TournamentArt.modeLabel(gameMode),
        contentScale = ContentScale.Crop,
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.28f)),
    )
}

/** Inline diamond / gold-coin currency icon. */
@Composable
fun CurrencyIcon(
    @DrawableRes iconRes: Int,
    modifier: Modifier = Modifier,
    size: Dp = 13.dp,
) {
    Image(
        painter = painterResource(id = iconRes),
        contentDescription = null,
        modifier = modifier.size(size),
    )
}
