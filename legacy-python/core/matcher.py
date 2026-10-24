"""Keyword rule matching engine.

A rule is a plain dict (as loaded from the DB). Two modes:

  simple:  include_terms + logic (AND/OR) + exclude_terms (NOT),
           with whole_word / case_sensitive toggles.
  regex:   a single regex pattern + case_sensitive.

The entry point is `match_message(text, rule)` -> bool.
`text` already includes media captions (Telethon puts the caption in
message.message), so caption matching is just a flag that decides
whether we bother testing media-only messages.
"""

import re


def _term_regex(term, whole_word, case_sensitive):
    """Compile a plain term into a regex (escaped, optionally word-bounded)."""
    flags = 0 if case_sensitive else re.IGNORECASE
    pat = re.escape(term.strip())
    if whole_word:
        # \b is weak for non-ASCII; use lookarounds on word chars.
        pat = r"(?<!\w)" + pat + r"(?!\w)"
    return re.compile(pat, flags)


def _contains(text, term, whole_word, case_sensitive):
    if not term.strip():
        return False
    return _term_regex(term, whole_word, case_sensitive).search(text) is not None


def match_message(text, rule):
    """Return True if `text` satisfies `rule`."""
    if not rule.get("enabled", True):
        return False
    if text is None:
        text = ""

    mode = rule.get("mode", "simple")

    if mode == "regex":
        pattern = rule.get("pattern", "")
        if not pattern:
            return False
        flags = 0 if rule.get("case_sensitive") else re.IGNORECASE
        try:
            return re.search(pattern, text, flags) is not None
        except re.error:
            return False

    # ----- simple mode -----
    whole = rule.get("whole_word", False)
    cs = rule.get("case_sensitive", False)

    include = [t for t in rule.get("include_terms", []) if t.strip()]
    exclude = [t for t in rule.get("exclude_terms", []) if t.strip()]

    # NOT: any excluded term present -> reject immediately.
    for term in exclude:
        if _contains(text, term, whole, cs):
            return False

    if not include:
        # No include terms = rule matches everything (subject to excludes).
        return True

    logic = rule.get("logic", "OR").upper()
    tests = (_contains(text, t, whole, cs) for t in include)
    return all(tests) if logic == "AND" else any(tests)


def explain(text, rule):
    """Human-readable match result for the in-app 'Test rule' feature."""
    ok = match_message(text, rule)
    return {"matched": ok, "rule": rule.get("name", "(unnamed)")}
