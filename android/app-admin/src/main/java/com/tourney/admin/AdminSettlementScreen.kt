package com.tourney.admin

import android.content.Intent
import androidx.core.content.FileProvider
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tourney.core.ui.AppButton
import com.tourney.core.ui.AppTopBar
import com.tourney.core.ui.ErrorState
import com.tourney.core.ui.GlassCard
import com.tourney.core.ui.LoadingState
import com.tourney.core.ui.formatMoney
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** Owner-only daily collections, payouts and reconciliation screen. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminSettlementScreen(
    viewModel: AdminViewModel,
    onBack: () -> Unit,
) {
    val today = remember { LocalDate.now(ZoneOffset.UTC).toString() }
    var selectedDate by remember { mutableStateOf(today) }
    var showDatePicker by remember { mutableStateOf(false) }
    var exportError by remember { mutableStateOf<String?>(null) }
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(Unit) { viewModel.loadSettlement(selectedDate) }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppTopBar(showBrandBadge = true, title = "Daily Settlement", onBack = onBack)

            when (val state = viewModel.settlementUi) {
                AdminUi.Idle, AdminUi.Loading -> LoadingState("Loading settlement…")
                is AdminUi.Error -> ErrorState(state.message) { viewModel.loadSettlement(selectedDate) }
                is AdminUi.Success -> {
                    val summary = state.data.summary
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                            Text("📅 Report date", fontWeight = FontWeight.Bold)
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Text(
                                    selectedDate,
                                    style = MaterialTheme.typography.titleMedium,
                                    modifier = Modifier.weight(1f).padding(top = 10.dp),
                                )
                                TextButton(onClick = { showDatePicker = true }) { Text("Choose date") }
                                TextButton(onClick = {
                                    selectedDate = today
                                    viewModel.loadSettlement(today)
                                }) { Text("Today") }
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            SettlementKpi(
                                title = "Collections",
                                value = "₹${formatMoney(summary.totalDeposits + summary.totalMatchRevenue)}",
                                detail = "Deposits ₹${formatMoney(summary.totalDeposits)} • Fees ₹${formatMoney(summary.totalMatchRevenue)}",
                                color = Color(0xFF00C853),
                                modifier = Modifier.weight(1f),
                            )
                            SettlementKpi(
                                title = "Payouts",
                                value = "₹${formatMoney(summary.totalWithdrawals + summary.totalPrizesPaid)}",
                                detail = "Withdrawals ₹${formatMoney(summary.totalWithdrawals)} • Prizes ₹${formatMoney(summary.totalPrizesPaid)}",
                                color = Color(0xFFE53935),
                                modifier = Modifier.weight(1f),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            SettlementKpi(
                                title = "Net Margin",
                                value = "₹${formatMoney(summary.netOrganizerProfit)}",
                                detail = "${summary.matchCount} scheduled match(es)",
                                color = if (summary.netOrganizerProfit >= 0) Color(0xFF00C853) else MaterialTheme.colorScheme.error,
                                modifier = Modifier.weight(1f),
                            )
                            SettlementKpi(
                                title = "Platform Cut",
                                value = "₹${formatMoney(summary.platformCut)}",
                                detail = "${formatMoney(summary.commissionRate)}% commission",
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.weight(1f),
                            )
                        }

                        GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 18.dp) {
                            Text("Reconciliation", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text("Approved deposits: ${summary.depositCount}", fontSize = 12.sp)
                            Text("Approved withdrawals: ${summary.withdrawalCount}", fontSize = 12.sp)
                            Text("Prize ledger entries: ${summary.prizeCount}", fontSize = 12.sp)
                            Text("Ledger rows in report: ${state.data.transactions.size}", fontSize = 12.sp)
                        }

                        AppButton(
                            text = if (viewModel.settlementExporting) "⏳ Preparing CSV…" else "⬇ Share / Download CSV",
                            enabled = !viewModel.settlementExporting,
                            onClick = {
                                exportError = null
                                viewModel.exportSettlementCsv(selectedDate) { file, error ->
                                    exportError = error
                                    if (file != null) {
                                        val uri = FileProvider.getUriForFile(
                                            context,
                                            "${context.packageName}.fileprovider",
                                            file,
                                        )
                                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/csv"
                                            putExtra(Intent.EXTRA_STREAM, uri)
                                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                        }
                                        context.startActivity(Intent.createChooser(shareIntent, "Share settlement CSV"))
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        exportError?.let { Text("⚠️ $it", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                    }
                }
            }
        }
    }

    if (showDatePicker) {
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = runCatching {
                LocalDate.parse(selectedDate).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
            }.getOrNull(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { millis ->
                        selectedDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()
                        viewModel.loadSettlement(selectedDate)
                    }
                    showDatePicker = false
                }) { Text("Apply") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Cancel") } },
        ) { DatePicker(state = pickerState) }
    }
}

@Composable
private fun SettlementKpi(
    title: String,
    value: String,
    detail: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    GlassCard(modifier = modifier, cornerRadius = 16.dp, contentPadding = 12.dp) {
        Text(title, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = FontWeight.Bold, color = color, style = MaterialTheme.typography.titleLarge)
        Text(detail, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
