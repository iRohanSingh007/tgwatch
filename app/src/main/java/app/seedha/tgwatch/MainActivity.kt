package app.seedha.tgwatch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
        Td.start(applicationContext)

        setContent {
            MaterialTheme(colorScheme = DarkColors) {
                Surface(Modifier.fillMaxSize()) {
                    val state by Td.authState.collectAsState()
                    var error by remember { mutableStateOf("") }

                    LaunchedEffect(Unit) {
                        Td.lastError.collect { error = it }
                    }

                    Column(
                        Modifier.fillMaxSize().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Spacer(Modifier.height(48.dp))
                        Text("TgWatch", style = MaterialTheme.typography.headlineMedium)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            stateLabel(state),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(32.dp))

                        when (state) {
                            "authorizationStateWaitPhoneNumber" ->
                                PhoneForm { Td.sendPhone(it) }
                            "authorizationStateWaitCode" ->
                                CodeForm { Td.sendCode(it) }
                            "authorizationStateWaitPassword" ->
                                PasswordForm { Td.sendPassword(it) }
                            "authorizationStateReady" ->
                                ReadyScreen()
                            else ->
                                CircularProgressIndicator()
                        }

                        if (error.isNotEmpty()) {
                            Spacer(Modifier.height(16.dp))
                            Text(error, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }
    }
}

private fun stateLabel(s: String) = when (s) {
    "authorizationStateWaitPhoneNumber" -> "Log in with your phone number"
    "authorizationStateWaitCode" -> "Enter the code Telegram sent"
    "authorizationStateWaitPassword" -> "Two-step verification password"
    "authorizationStateReady" -> "Connected ✓"
    "" -> "Starting TDLib…"
    else -> "Connecting…"
}

@Composable
private fun PhoneForm(onSubmit: (String) -> Unit) {
    var v by remember { mutableStateOf("") }
    OutlinedTextField(
        value = v, onValueChange = { v = it },
        label = { Text("+country code phone") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(16.dp))
    Button(onClick = { onSubmit(v.trim()) }, modifier = Modifier.fillMaxWidth()) {
        Text("Send code")
    }
}

@Composable
private fun CodeForm(onSubmit: (String) -> Unit) {
    var v by remember { mutableStateOf("") }
    OutlinedTextField(
        value = v, onValueChange = { v = it },
        label = { Text("Login code") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(16.dp))
    Button(onClick = { onSubmit(v.trim()) }, modifier = Modifier.fillMaxWidth()) {
        Text("Verify")
    }
}

@Composable
private fun PasswordForm(onSubmit: (String) -> Unit) {
    var v by remember { mutableStateOf("") }
    OutlinedTextField(
        value = v, onValueChange = { v = it },
        label = { Text("Password") },
        visualTransformation = PasswordVisualTransformation(),
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(16.dp))
    Button(onClick = { onSubmit(v) }, modifier = Modifier.fillMaxWidth()) {
        Text("Unlock")
    }
}

@Composable
private fun ReadyScreen() {
    Text(
        "You're logged in. Chat selection, keyword rules, and monitoring come next.",
        style = MaterialTheme.typography.bodyLarge,
    )
}
