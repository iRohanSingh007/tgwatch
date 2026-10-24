package app.seedha.tgwatch

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class HistoryItem(
    val ruleName: String,
    val chatTitle: String,
    val text: String,
    val link: String,
    val ts: Long,
)

/**
 * Simple on-device persistence (JSON files in filesDir). Small data set:
 * keyword rules, the set of watched chat ids, and match history.
 * Exposes StateFlows the Compose UI observes.
 */
object Store {
    val rules = MutableStateFlow<List<Rule>>(emptyList())
    val watched = MutableStateFlow<Set<Long>>(emptySet())
    val history = MutableStateFlow<List<HistoryItem>>(emptyList())

    private lateinit var dir: File
    private const val HISTORY_CAP = 500

    fun init(context: Context) {
        dir = context.filesDir
        rules.value = loadRules()
        watched.value = loadWatched()
        history.value = loadHistory()
    }

    private fun file(name: String) = File(dir, name)

    // ---- rules ----
    private fun loadRules(): List<Rule> {
        val f = file("rules.json")
        if (!f.exists()) return emptyList()
        return try {
            val arr = JSONArray(f.readText())
            (0 until arr.length()).map { i -> ruleFromJson(arr.getJSONObject(i)) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun saveRule(rule: Rule) {
        val list = rules.value.toMutableList()
        val idx = list.indexOfFirst { it.id == rule.id }
        if (rule.id != 0 && idx >= 0) list[idx] = rule
        else {
            val newId = (list.maxOfOrNull { it.id } ?: 0) + 1
            list.add(rule.copy(id = newId))
        }
        rules.value = list
        persistRules()
    }

    fun deleteRule(id: Int) {
        rules.value = rules.value.filter { it.id != id }
        persistRules()
    }

    private fun persistRules() {
        val arr = JSONArray()
        rules.value.forEach { arr.put(ruleToJson(it)) }
        file("rules.json").writeText(arr.toString())
    }

    private fun ruleToJson(r: Rule) = JSONObject().apply {
        put("id", r.id); put("name", r.name); put("enabled", r.enabled)
        put("mode", r.mode); put("logic", r.logic)
        put("wholeWord", r.wholeWord); put("caseSensitive", r.caseSensitive)
        put("pattern", r.pattern)
        put("includeTerms", JSONArray(r.includeTerms))
        put("excludeTerms", JSONArray(r.excludeTerms))
    }

    private fun ruleFromJson(o: JSONObject): Rule {
        fun strList(key: String): List<String> {
            val a = o.optJSONArray(key) ?: return emptyList()
            return (0 until a.length()).map { a.getString(it) }
        }
        return Rule(
            id = o.optInt("id"),
            name = o.optString("name"),
            enabled = o.optBoolean("enabled", true),
            mode = o.optString("mode", "simple"),
            includeTerms = strList("includeTerms"),
            excludeTerms = strList("excludeTerms"),
            pattern = o.optString("pattern"),
            logic = o.optString("logic", "OR"),
            wholeWord = o.optBoolean("wholeWord", false),
            caseSensitive = o.optBoolean("caseSensitive", false),
        )
    }

    // ---- watched chats ----
    private fun loadWatched(): Set<Long> {
        val f = file("watched.json")
        if (!f.exists()) return emptySet()
        return try {
            val arr = JSONArray(f.readText())
            (0 until arr.length()).map { arr.getLong(it) }.toSet()
        } catch (e: Exception) {
            emptySet()
        }
    }

    fun setWatched(chatId: Long, on: Boolean) {
        val s = watched.value.toMutableSet()
        if (on) s.add(chatId) else s.remove(chatId)
        watched.value = s
        file("watched.json").writeText(JSONArray(s.toList()).toString())
    }

    // ---- history ----
    private fun loadHistory(): List<HistoryItem> {
        val f = file("history.json")
        if (!f.exists()) return emptyList()
        return try {
            val arr = JSONArray(f.readText())
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                HistoryItem(o.getString("ruleName"), o.getString("chatTitle"),
                    o.getString("text"), o.getString("link"), o.getLong("ts"))
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun addHistory(item: HistoryItem) {
        val list = (listOf(item) + history.value).take(HISTORY_CAP)
        history.value = list
        val arr = JSONArray()
        list.forEach {
            arr.put(JSONObject().apply {
                put("ruleName", it.ruleName); put("chatTitle", it.chatTitle)
                put("text", it.text); put("link", it.link); put("ts", it.ts)
            })
        }
        file("history.json").writeText(arr.toString())
    }
}
