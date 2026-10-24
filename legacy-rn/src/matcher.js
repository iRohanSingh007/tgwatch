// Keyword rule matching engine (ported from the tested Python version).
//
// A rule is a plain object:
//   { mode: 'simple'|'regex', enabled, logic: 'AND'|'OR',
//     includeTerms: [], excludeTerms: [], pattern,
//     wholeWord, caseSensitive }
//
// matchMessage(text, rule) -> boolean

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRegex(term, wholeWord, caseSensitive) {
  const flags = caseSensitive ? "" : "i";
  let pat = escapeRegex(term.trim());
  if (wholeWord) {
    // Lookarounds on word chars (more robust than \b for mixed scripts).
    pat = `(?<!\\w)${pat}(?!\\w)`;
  }
  return new RegExp(pat, flags);
}

function contains(text, term, wholeWord, caseSensitive) {
  if (!term.trim()) return false;
  try {
    return termRegex(term, wholeWord, caseSensitive).test(text);
  } catch {
    return false;
  }
}

export function matchMessage(text, rule) {
  if (rule.enabled === false) return false;
  if (text == null) text = "";

  if (rule.mode === "regex") {
    if (!rule.pattern) return false;
    try {
      return new RegExp(rule.pattern, rule.caseSensitive ? "" : "i").test(text);
    } catch {
      return false;
    }
  }

  const whole = !!rule.wholeWord;
  const cs = !!rule.caseSensitive;
  const include = (rule.includeTerms || []).filter((t) => t.trim());
  const exclude = (rule.excludeTerms || []).filter((t) => t.trim());

  // NOT: any excluded term present -> reject.
  for (const term of exclude) {
    if (contains(text, term, whole, cs)) return false;
  }

  if (include.length === 0) return true; // excludes only

  const logic = (rule.logic || "OR").toUpperCase();
  const results = include.map((t) => contains(text, t, whole, cs));
  return logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}
