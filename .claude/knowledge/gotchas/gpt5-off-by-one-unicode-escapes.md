---
topic: gpt-5 emits off-by-one unicode escapes in json_object mode
source: production log /opt/1khx-marketing-slack-bot/logs/2026-08-05.log (14:03 run)
discovered: 2026-08-05
---

gpt-5 with `response_format: { type: "json_object" }` intermittently writes an extra
zero into unicode escapes for ASCII punctuation:

- `\u00027` instead of `'` (`'`)
- `\u0002d` instead of `-` (`-`)

The result is **valid JSON**: `\u0002` parses as U+0002 (STX) and the trailing hex
digit stays a literal character. So `JSON.parse` succeeds, no sanitizer fires, and
Slack silently drops the control char — leaving `won7t` and `humandled` in the post.

Diagnosis trap: grepping the raw log for `u002` returns 0 hits, because the literal
substring is `u0002d`. Grep for `u0002` instead.

Fix (in `src/index.js`): repair **before** parsing, always — not in a catch block,
since the JSON is never malformed:

```js
s.replace(/\\u000([0-9a-fA-F])([0-9a-fA-F])/g, "\\u00$1$2")
```

Stripping control characters post-parse is not sufficient on its own: removing STX
from `human␂dled` still yields `humandled`. Genuine escapes (`’`, `—`,
`‑`) are untouched by the repair.
