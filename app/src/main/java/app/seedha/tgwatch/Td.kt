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

    // Known chats the user can watch (channels / groups).
    data class ChatInfo(val id: Long, val title: String)
    val chats = MutableStateFlow<Map<Long, ChatInfo>>(emptyMap())

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
            "updateNewChat" -> {
                obj.optJSONObject("chat")?.let { registerChat(it) }
            }
            "updateChatTitle" -> {
                val id = obj.optLong("chat_id")
                val title = obj.optString("title")
                val cur = chats.value[id]
                if (cur != null) chats.value = chats.value + (id to cur.copy(title = title))
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
            "authorizationStateReady" -> {
                loadChats()
            }
        }
    }

    private fun registerChat(chat: JSONObject) {
        val id = chat.optLong("id")
        val type = chat.optJSONObject("type")?.optString("@type")
        // Only channels / groups are watch candidates (not private DMs).
        if (type == "chatTypeSupergroup" || type == "chatTypeBasicGroup") {
            val title = chat.optString("title", id.toString())
            chats.value = chats.value + (id to ChatInfo(id, title))
        }
    }

    fun loadChats() {
        send(
            JSONObject().put("@type", "loadChats")
                .put("chat_list", JSONObject().put("@type", "chatListMain"))
                .put("limit", 200)
        )
    }

    /** Extract the text/caption from an updateNewMessage payload. */
    fun messageText(update: JSONObject): String {
        val content = update.optJSONObject("message")?.optJSONObject("content") ?: return ""
        content.optJSONObject("text")?.let { return it.optString("text") }
        content.optJSONObject("caption")?.let { return it.optString("text") }
        return ""
    }

    /** Build a t.me deep link for a message in a channel/supergroup. */
    fun messageLink(chatId: Long, messageId: Long): String {
        // Supergroup/channel chat ids look like -100XXXXXXXXXX.
        val internal = -chatId - 1_000_000_000_000L
        val serverMsgId = messageId shr 20
        return if (internal > 0) "https://t.me/c/$internal/$serverMsgId"
        else "https://t.me/"
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
