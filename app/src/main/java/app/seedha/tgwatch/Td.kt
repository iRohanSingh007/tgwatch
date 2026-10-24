package app.seedha.tgwatch

import android.content.Context
import io.github.up9cloud.td.JsonClient
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONObject
import kotlin.concurrent.thread

/**
 * Thin Kotlin wrapper over TDLib's JSON client interface.
 *
 * TDLib runs natively (libtdjson.so) and does all MTProto crypto/transport —
 * this just pumps its receive loop on a background thread, drives the
 * authorization state machine, and surfaces state as flows for Compose.
 */
object Td {
    const val API_ID = 3477714
    const val API_HASH = "1264d2d7d397c4635147ee25ab5808d1"

    // Current authorization state name, e.g. authorizationStateWaitPhoneNumber.
    val authState = MutableStateFlow("")
    // Last error (TDLib "error" result) for the UI to show.
    val lastError = MutableSharedFlow<String>(extraBufferCapacity = 8)
    // Incoming new messages (raw JSON), consumed by the monitor.
    val newMessages = MutableSharedFlow<JSONObject>(extraBufferCapacity = 64)

    private var clientId: Int = -1
    private var dbDir: String = ""
    private var running = false

    fun start(context: Context) {
        if (running) return
        running = true
        dbDir = context.filesDir.resolve("td").absolutePath
        clientId = JsonClient.td_create_client_id()
        // Kick the client so TDLib starts emitting updates.
        send(JSONObject().put("@type", "getOption").put("name", "version"))
        thread(name = "td-recv", isDaemon = true) { receiveLoop() }
    }

    fun send(obj: JSONObject) {
        JsonClient.td_send(clientId, obj.toString())
    }

    private fun receiveLoop() {
        while (running) {
            val res = JsonClient.td_receive(5.0) ?: continue
            try {
                handle(JSONObject(res))
            } catch (_: Exception) {
            }
        }
    }

    private fun handle(obj: JSONObject) {
        when (obj.optString("@type")) {
            "updateAuthorizationState" -> {
                val st = obj.optJSONObject("authorization_state") ?: return
                onAuthState(st)
            }
            "updateNewMessage" -> {
                newMessages.tryEmit(obj)
            }
            "error" -> {
                lastError.tryEmit(obj.optString("message", "error"))
            }
        }
    }

    private fun onAuthState(st: JSONObject) {
        val type = st.optString("@type")
        authState.value = type
        when (type) {
            "authorizationStateWaitTdlibParameters" -> {
                send(
                    JSONObject()
                        .put("@type", "setTdlibParameters")
                        .put("database_directory", dbDir)
                        .put("use_message_database", true)
                        .put("use_secret_chats", false)
                        .put("api_id", API_ID)
                        .put("api_hash", API_HASH)
                        .put("system_language_code", "en")
                        .put("device_model", "Android")
                        .put("application_version", "0.1")
                )
            }
            "authorizationStateWaitEncryptionKey" -> {
                // Older TDLib builds still ask for this; empty key is fine.
                send(JSONObject().put("@type", "checkDatabaseEncryptionKey").put("encryption_key", ""))
            }
        }
    }

    // ---- login actions ----
    fun sendPhone(phone: String) {
        send(JSONObject().put("@type", "setAuthenticationPhoneNumber").put("phone_number", phone))
    }

    fun sendCode(code: String) {
        send(JSONObject().put("@type", "checkAuthenticationCode").put("code", code))
    }

    fun sendPassword(password: String) {
        send(JSONObject().put("@type", "checkAuthenticationPassword").put("password", password))
    }

    fun logout() {
        send(JSONObject().put("@type", "logOut"))
    }
}
