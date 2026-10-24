package app.seedha.tgwatch

/**
 * Keyword rule matching (ported from the tested JS/Python versions).
 *
 * Simple mode: include terms + AND/OR + exclude terms (NOT), with
 * whole-word and case-sensitivity toggles. Regex mode: a single pattern.
 */
data class Rule(
    val id: Int,
    val name: String,
    val enabled: Boolean = true,
    val mode: String = "simple",           // "simple" | "regex"
    val includeTerms: List<String> = emptyList(),
    val excludeTerms: List<String> = emptyList(),
    val pattern: String = "",
    val logic: String = "OR",              // "OR" | "AND"
    val wholeWord: Boolean = false,
    val caseSensitive: Boolean = false,
)

object Matcher {
    private fun termRegex(term: String, wholeWord: Boolean, caseSensitive: Boolean): Regex {
        val opts = if (caseSensitive) emptySet() else setOf(RegexOption.IGNORE_CASE)
        var pat = Regex.escape(term.trim())
        if (wholeWord) pat = "(?<!\\w)$pat(?!\\w)"
        return Regex(pat, opts)
    }

    private fun contains(text: String, term: String, wholeWord: Boolean, caseSensitive: Boolean): Boolean {
        if (term.isBlank()) return false
        return try {
            termRegex(term, wholeWord, caseSensitive).containsMatchIn(text)
        } catch (e: Exception) {
            false
        }
    }

    fun match(text: String?, rule: Rule): Boolean {
        if (!rule.enabled) return false
        val t = text ?: ""

        if (rule.mode == "regex") {
            if (rule.pattern.isBlank()) return false
            return try {
                val opts = if (rule.caseSensitive) emptySet() else setOf(RegexOption.IGNORE_CASE)
                Regex(rule.pattern, opts).containsMatchIn(t)
            } catch (e: Exception) {
                false
            }
        }

        val include = rule.includeTerms.filter { it.isNotBlank() }
        val exclude = rule.excludeTerms.filter { it.isNotBlank() }

        for (term in exclude) if (contains(t, term, rule.wholeWord, rule.caseSensitive)) return false
        if (include.isEmpty()) return true

        val results = include.map { contains(t, it, rule.wholeWord, rule.caseSensitive) }
        return if (rule.logic.uppercase() == "AND") results.all { it } else results.any { it }
    }
}
