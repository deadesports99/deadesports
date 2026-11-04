package com.tourney.core.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.TournamentStatus

/** Color-coded lifecycle chip: OPEN green, SLOTS_FULL amber, ROOM_REVEALED cyan, etc. */
@Composable
fun StatusBadge(
    status: TournamentStatus,
    hasCredentials: Boolean? = null,
    modifier: Modifier = Modifier,
) {
    val (label, bg, fg) = when (status) {
        TournamentStatus.OPEN -> Triple("OPEN", Color(0xFF1B5E20), Color.White)
        TournamentStatus.UPCOMING -> Triple("UPCOMING", Color(0xFF37474F), Color.White)
        TournamentStatus.SLOTS_FULL -> Triple("SLOTS FULL", Color(0xFFE65100), Color.White)
        TournamentStatus.ROOM_REVEALED -> if (hasCredentials == false) {
            Triple("ROOM SOON", Color(0xFFE65100), Color.White)
        } else {
            Triple("ROOM OUT", Color(0xFF01579B), Color.White)
        }
        TournamentStatus.LIVE -> Triple("LIVE", Color(0xFFB71C1C), Color.White)
        TournamentStatus.UNDER_REVIEW -> Triple("REVIEW", Color(0xFF4A148C), Color.White)
        TournamentStatus.COMPLETED -> Triple("COMPLETED", Color(0xFF263238), Color.White)
        TournamentStatus.CANCELLED -> Triple("CANCELLED", Color(0xFF616161), Color.White)
        TournamentStatus.DRAFT -> Triple("DRAFT", Color(0xFF546E7A), Color.White)
    }
    Surface(color = bg, shape = MaterialTheme.shapes.small) {
        Text(
            text = label,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}