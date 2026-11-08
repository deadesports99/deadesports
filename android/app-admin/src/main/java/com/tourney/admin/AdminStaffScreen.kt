package com.tourney.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.model.StaffMember
import com.tourney.core.model.StaffPermissions
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState

/**
 * 👥 STAFF MANAGEMENT (ADMIN / owner only)
 *
 * Hire sub-admins and hand out granular permissions. Staff accounts log in on
 * the Admin app with their phone number (same phone-login as players — no
 * password to leak or reset), and the dashboard only shows the consoles their
 * flags allow.
 *
 * Removing a staff member is a soft delete: the account is banned (cannot log
 * in) and every permission is revoked, but historic ledger/audit rows that
 * reference them stay intact.
 */
@Composable
fun AdminStaffScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    var showHire by remember { mutableStateOf(false) }
    var editTarget by remember { mutableStateOf<StaffMember?>(null) }
    var removeTarget by remember { mutableStateOf<StaffMember?>(null) }

    LaunchedEffect(Unit) {
        viewModel.clearStaffFeedback()
        viewModel.loadStaff()
    }

    val state = viewModel.staffUi

    Column(modifier = Modifier.fillMaxSize()) {
        AppTopBar(
            showBrandBadge = true,
            title = "Staff Management",
            onBack = onBack,
            actions = {
                TextButton(onClick = { viewModel.loadStaff() }) { Text("Refresh") }
            },
        )

        viewModel.staffMessage?.let {
            Text(
                it,
                color = Color(0xFF1B5E20),
                fontSize = 13.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
            )
        }
        viewModel.staffError?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
            )
        }

        when (state) {
            AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading staff…")
            is AdminUi.Error -> ErrorState(state.message) { viewModel.loadStaff() }
            is AdminUi.Success -> {
                val staff = state.data.staff
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            "👥 ${staff.count { it.isActive }} active • ${staff.size} total",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Staff log in to this Admin app with their phone number. " +
                                "Only the permissions you tick below are visible to them.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp,
                        )
                        AppButton(
                            text = "➕ Hire Staff Member",
                            onClick = { showHire = true },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 10.dp),
                        )
                    }

                    if (staff.isEmpty()) {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text("No staff hired yet", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(
                                "Hire a room manager, scorer or cashier and give them only the access they need.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    staff.forEach { member ->
                        StaffCard(
                            member = member,
                            busy = viewModel.staffBusy,
                            onEdit = { editTarget = member },
                            onRemove = { removeTarget = member },
                            onReactivate = {
                                viewModel.updateStaff(
                                    id = member.id,
                                    permissions = member.permissions,
                                    name = member.name,
                                    email = member.email,
                                    isActive = true,
                                )
                            },
                        )
                    }
                }
            }
        }
    }

    if (showHire) {
        StaffFormDialog(
            initial = null,
            busy = viewModel.staffBusy,
            onDismiss = { showHire = false },
            onSubmit = { name, phone, email, permissions ->
                viewModel.createStaff(name, email, phone, permissions)
                showHire = false
            },
        )
    }

    editTarget?.let { member ->
        StaffFormDialog(
            initial = member,
            busy = viewModel.staffBusy,
            onDismiss = { editTarget = null },
            onSubmit = { name, phone, email, permissions ->
                viewModel.updateStaff(
                    id = member.id,
                    permissions = permissions,
                    name = name,
                    email = email,
                )
                editTarget = null
            },
        )
    }

    removeTarget?.let { member ->
        AlertDialog(
            onDismissRequest = { if (!viewModel.staffBusy) removeTarget = null },
            title = { Text("Remove ${member.name ?: member.phoneNumber}?") },
            text = {
                Text(
                    "They will be logged out and can no longer sign in or access any console. " +
                        "Old match/ledger history stays intact.",
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                AppButton(
                    text = if (viewModel.staffBusy) "Removing…" else "Remove Staff",
                    enabled = !viewModel.staffBusy,
                    onClick = {
                        viewModel.deactivateStaff(member.id)
                        removeTarget = null
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { removeTarget = null }, enabled = !viewModel.staffBusy) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun StaffCard(
    member: StaffMember,
    busy: Boolean,
    onEdit: () -> Unit,
    onRemove: () -> Unit,
    onReactivate: () -> Unit,
) {
    GlassCard(cornerRadius = 14.dp, modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        member.name ?: "Unnamed staff",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "📱 ${member.phoneNumber}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 12.sp,
                    )
                    member.email?.let {
                        Text(
                            "✉ $it",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp,
                        )
                    }
                }
                StatusPill(
                    text = if (member.isActive) "ACTIVE" else "REMOVED",
                    tint = if (member.isActive) Color(0xFF2E7D32) else Color(0xFF9E9E9E),
                )
            }

            val chips = member.permissionChips
            if (chips.isEmpty()) {
                Text(
                    "🔒 No permissions — view only",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Text(chips.joinToString("   "), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (member.isActive) {
                    AppButton(
                        text = "✏️ Permissions",
                        enabled = !busy,
                        onClick = onEdit,
                        modifier = Modifier.weight(1.1f),
                    )
                    AppButton(
                        text = "Remove",
                        enabled = !busy,
                        onClick = onRemove,
                        modifier = Modifier.weight(0.9f),
                    )
                } else {
                    AppButton(
                        text = "♻ Re-activate",
                        enabled = !busy,
                        onClick = onReactivate,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusPill(text: String, tint: Color) {
    Surface(color = tint.copy(alpha = 0.16f), shape = MaterialTheme.shapes.small) {
        Text(
            text,
            color = tint,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
        )
    }
}

/**
 * Hire / edit dialog — same form for both. Phone number is the login; email is
 * used for receipts and the audit trail (the backend requires it).
 */
@Composable
private fun StaffFormDialog(
    initial: StaffMember?,
    busy: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (name: String, phone: String, email: String, permissions: StaffPermissions) -> Unit,
) {
    var name by remember(initial) { mutableStateOf(initial?.name ?: "") }
    var phone by remember(initial) { mutableStateOf(initial?.phoneNumber ?: "") }
    var email by remember(initial) { mutableStateOf(initial?.email ?: "") }
    var perms by remember(initial) { mutableStateOf(initial?.permissions ?: StaffPermissions.NONE) }
    var error by remember { mutableStateOf<String?>(null) }

    val isEdit = initial != null
    val phoneValid = Regex("^\\+?[1-9]\\d{9,14}$").matches(phone.trim())
    val emailValid = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email.trim())
    val nameValid = name.trim().length >= 2

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(if (isEdit) "Edit Staff Permissions" else "Hire Staff Member") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(80); error = null },
                    label = { Text("Full name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = phone,
                    onValueChange = { input ->
                        phone = input.filter { it.isDigit() || it == '+' }.take(15)
                        error = null
                    },
                    label = { Text("Phone number (their login)") },
                    placeholder = { Text("e.g. 9876543210") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    isError = phone.isNotEmpty() && !phoneValid,
                    supportingText = { Text("Staff opens the Admin app and logs in with this number", fontSize = 10.sp) },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it.take(254); error = null },
                    label = { Text("Email") },
                    placeholder = { Text("staff@example.com") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    isError = email.isNotEmpty() && !emailValid,
                    modifier = Modifier.fillMaxWidth(),
                )

                Text(
                    "Permissions",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                PermissionToggle(
                    emoji = "🎮",
                    title = "Can Create Match",
                    subtitle = "Schedule tournaments, set fees & prizes",
                    checked = perms.canCreateMatch,
                    onCheckedChange = { perms = perms.copy(canCreateMatch = it) },
                )
                PermissionToggle(
                    emoji = "🔑",
                    title = "Can Update Room ID / Password",
                    subtitle = "Publish custom room credentials (admin-controlled reveal)",
                    checked = perms.canUpdateRoomId,
                    onCheckedChange = { perms = perms.copy(canUpdateRoomId = it) },
                )
                PermissionToggle(
                    emoji = "🏆",
                    title = "Can Distribute Prize",
                    subtitle = "Spectator scorer: kills, ranks, 1-click payout",
                    checked = perms.canDistributePrize,
                    onCheckedChange = { perms = perms.copy(canDistributePrize = it) },
                )
                PermissionToggle(
                    emoji = "💳",
                    title = "Can Manage Wallet",
                    subtitle = "Approve deposits (UTR) & player withdrawals",
                    checked = perms.canManageWallet,
                    onCheckedChange = { perms = perms.copy(canManageWallet = it) },
                )

                error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            }
        },
        confirmButton = {
            AppButton(
                text = when {
                    busy -> "Saving…"
                    isEdit -> "Save Permissions"
                    else -> "Hire Staff"
                },
                enabled = !busy && nameValid && phoneValid && emailValid,
                onClick = {
                    if (!nameValid || !phoneValid || !emailValid) {
                        error = "Enter a valid name, 10-digit phone number and email"
                        return@AppButton
                    }
                    onSubmit(name.trim(), phone.trim(), email.trim(), perms)
                },
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") }
        },
    )
}

@Composable
private fun PermissionToggle(
    emoji: String,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(emoji, fontSize = 16.sp)
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(subtitle, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
