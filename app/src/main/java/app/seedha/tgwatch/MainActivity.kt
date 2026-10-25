@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.seedha.tgwatch

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

private val DarkColors = darkColorScheme(
    primary = Color(0xFF38A0F0),
    background = Color(0xFF0D1117),
    surface = Color(0xFF151B23),
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Store.init(applicationContext)
        Td.start(applicationContext)
        // The foreground service owns the live monitor so it survives the UI closing.
        MonitorService.start(applicationContext)

        setContent {
            MaterialTheme(colorScheme = DarkColors) {
                val state by Td.authState.collectAsState()

                // Ask for notification permission on Android 13+.
                val permLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) {}
                LaunchedEffect(Unit) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        permLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }

                Surface(Modifier.fillMaxSize()) {
                    if (state == "authorizationStateReady") MainScreen()
                    else LoginScreen(state)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- login
@Composable
private fun LoginScreen(state: String) {
    var error by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { Td.lastError.collect { error = it } }

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(64.dp))
        Text("TgWatch", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            when (state) {
                "authorizationStateWaitPhoneNumber" -> "Log in with your phone number"
                "authorizationStateWaitCode" -> "Enter the code Telegram sent"
                "authorizationStateWaitPassword" -> "Two-step verification password"
                "" -> "Starting TDLib…"
                else -> "Connecting…"
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(32.dp))
        when (state) {
            "authorizationStateWaitPhoneNumber" -> Field("+country code phone", KeyboardType.Phone, "Send code") { Td.sendPhone(it) }
            "authorizationStateWaitCode" -> Field("Login code", KeyboardType.Number, "Verify") { Td.sendCode(it) }
            "authorizationStateWaitPassword" -> Field("Password", KeyboardType.Password, "Unlock", password = true) { Td.sendPassword(it) }
            else -> CircularProgressIndicator()
        }
        if (error.isNotEmpty()) {
            Spacer(Modifier.height(16.dp)); Text(error, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun Field(label: String, kb: KeyboardType, action: String, password: Boolean = false, onSubmit: (String) -> Unit) {
    var v by remember { mutableStateOf("") }
    OutlinedTextField(
        value = v, onValueChange = { v = it }, label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = kb),
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(16.dp))
    Button(onClick = { onSubmit(v.trim()) }, modifier = Modifier.fillMaxWidth()) { Text(action) }
}

// ---------------------------------------------------------------- main
@Composable
private fun MainScreen() {
    var tab by remember { mutableStateOf(0) }
    var editing by remember { mutableStateOf<Rule?>(null) }

    if (editing != null) {
        RuleEditor(editing!!, onClose = { editing = null })
        return
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(tab == 0, { tab = 0 }, { Icon(Icons.Default.List, null) }, label = { Text("Rules") })
                NavigationBarItem(tab == 1, { tab = 1 }, { Icon(Icons.Default.DateRange, null) }, label = { Text("History") })
                NavigationBarItem(tab == 2, { tab = 2 }, { Icon(Icons.Default.Person, null) }, label = { Text("Chats") })
            }
        },
        floatingActionButton = {
            if (tab == 0) FloatingActionButton(onClick = { editing = Rule(0, "") }) { Icon(Icons.Default.Add, null) }
        },
    ) { pad ->
        Column(Modifier.padding(pad)) {
            BatteryBanner()
            Box(Modifier.weight(1f)) {
                when (tab) {
                    0 -> RulesTab(onEdit = { editing = it })
                    1 -> HistoryTab()
                    2 -> ChatsTab()
                }
            }
        }
    }
}

@Composable
private fun BatteryBanner() {
    val context = LocalContext.current
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    var dismissed by remember { mutableStateOf(false) }
    val ignoring = remember { pm.isIgnoringBatteryOptimizations(context.packageName) }
    if (ignoring || dismissed) return
    ElevatedCard(Modifier.fillMaxWidth().padding(8.dp)) {
        Column(Modifier.padding(12.dp)) {
            Text("Keep alerts reliable", style = MaterialTheme.typography.titleSmall)
            Text(
                "Allow TgWatch to run in the background so it keeps watching when closed. On Realme/ColorOS this is required.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(Modifier.align(Alignment.End)) {
                TextButton(onClick = { dismissed = true }) { Text("Later") }
                FilledTonalButton(onClick = {
                    runCatching {
                        context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
                    }
                }) { Text("Open settings") }
            }
        }
    }
}

@Composable
private fun RulesTab(onEdit: (Rule) -> Unit) {
    val rules by Store.rules.collectAsState()
    if (rules.isEmpty()) {
        CenterText("No rules yet.\nTap + to create your first keyword rule.")
        return
    }
    LazyColumn(Modifier.fillMaxSize().padding(8.dp)) {
        items(rules) { r ->
            ElevatedCard(Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { onEdit(r) }) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text((if (r.enabled) "" else "✗ ") + r.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            if (r.mode == "regex") "regex: ${r.pattern}"
                            else "${r.logic} · ${r.includeTerms.joinToString(", ").ifEmpty { "(any)" }}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    IconButton(onClick = { Store.deleteRule(r.id) }) { Icon(Icons.Default.Delete, null) }
                }
            }
        }
    }
}

@Composable
private fun HistoryTab() {
    val history by Store.history.collectAsState()
    val context = LocalContext.current
    if (history.isEmpty()) {
        CenterText("No matches yet.\nWatched chats with a keyword hit show here.")
        return
    }
    LazyColumn(Modifier.fillMaxSize().padding(8.dp)) {
        items(history) { h ->
            ElevatedCard(
                Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable {
                    runCatching {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(h.link)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                }
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text("[${h.ruleName}] ${h.chatTitle}", style = MaterialTheme.typography.titleSmall)
                    Text(h.text.take(160), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Tap to open in Telegram →", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

@Composable
private fun ChatsTab() {
    val chats by Td.chats.collectAsState()
    val watched by Store.watched.collectAsState()
    var query by remember { mutableStateOf("") }
    val list = chats.values
        .filter { query.isBlank() || it.title.contains(query, ignoreCase = true) }
        .sortedBy { it.title.lowercase() }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search chats") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                trailingIcon = {
                    if (query.isNotEmpty()) IconButton(onClick = { query = "" }) { Icon(Icons.Default.Clear, null) }
                },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { Td.loadChats() }) { Icon(Icons.Default.Refresh, null) }
        }
        when {
            chats.isEmpty() -> CenterText("Loading your chats…\nTap ⟳ to reload.")
            list.isEmpty() -> CenterText("No chats match \"$query\".")
            else -> LazyColumn(Modifier.fillMaxSize()) {
                items(list) { c ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(c.title, Modifier.weight(1f))
                        Switch(checked = c.id in watched, onCheckedChange = { Store.setWatched(c.id, it) })
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun CenterText(text: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ---------------------------------------------------------------- rule editor
@Composable
private fun RuleEditor(rule: Rule, onClose: () -> Unit) {
    var name by remember { mutableStateOf(rule.name) }
    var regex by remember { mutableStateOf(rule.mode == "regex") }
    var include by remember { mutableStateOf(rule.includeTerms.joinToString(", ")) }
    var exclude by remember { mutableStateOf(rule.excludeTerms.joinToString(", ")) }
    var pattern by remember { mutableStateOf(rule.pattern) }
    var andLogic by remember { mutableStateOf(rule.logic.uppercase() == "AND") }
    var wholeWord by remember { mutableStateOf(rule.wholeWord) }
    var caseSensitive by remember { mutableStateOf(rule.caseSensitive) }
    var enabled by remember { mutableStateOf(rule.enabled) }
    var sample by remember { mutableStateOf("") }
    var testResult by remember { mutableStateOf<Boolean?>(null) }

    fun build() = rule.copy(
        name = name.ifBlank { "rule" },
        mode = if (regex) "regex" else "simple",
        includeTerms = include.split(",").map { it.trim() }.filter { it.isNotEmpty() },
        excludeTerms = exclude.split(",").map { it.trim() }.filter { it.isNotEmpty() },
        pattern = pattern,
        logic = if (andLogic) "AND" else "OR",
        wholeWord = wholeWord, caseSensitive = caseSensitive, enabled = enabled,
    )

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(if (rule.id == 0) "New rule" else "Edit rule") },
            navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.Default.ArrowBack, null) } },
            actions = { IconButton(onClick = { Store.saveRule(build()); onClose() }) { Icon(Icons.Default.Check, null) } },
        )
        Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
            OutlinedTextField(name, { name = it }, label = { Text("Rule name") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            ToggleRow("Regex mode", regex) { regex = it }
            if (regex) {
                OutlinedTextField(pattern, { pattern = it }, label = { Text("Regex pattern") }, modifier = Modifier.fillMaxWidth())
            } else {
                OutlinedTextField(include, { include = it }, label = { Text("Include terms (comma separated)") }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(exclude, { exclude = it }, label = { Text("Exclude terms — NOT") }, modifier = Modifier.fillMaxWidth())
                ToggleRow("Match ALL (AND)", andLogic) { andLogic = it }
                ToggleRow("Whole word only", wholeWord) { wholeWord = it }
            }
            ToggleRow("Case sensitive", caseSensitive) { caseSensitive = it }
            ToggleRow("Enabled", enabled) { enabled = it }

            Spacer(Modifier.height(16.dp)); HorizontalDivider(); Spacer(Modifier.height(16.dp))
            Text("Test this rule", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(sample, { sample = it; testResult = null }, label = { Text("Paste a sample message") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            FilledTonalButton(onClick = { testResult = Matcher.match(sample, build()) }) { Text("Test") }
            testResult?.let {
                Text(if (it) "✓ MATCHES" else "✗ no match", color = if (it) Color(0xFF4CAF50) else Color(0xFFEF5350))
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
