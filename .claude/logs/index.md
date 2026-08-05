## 2026-08-05 (Wednesday)
**Log:** [sessions/2026-08-05.md](sessions/2026-08-05.md) | **Est. cost:** ~$1.20
- Diagnosed mangled 14:03 post — apostrophes → `7`, hyphens → `d` in GPT-generated fields only
- Root cause from droplet log: gpt-5 emitted off-by-one escapes (`d` for `-`), producing valid JSON with an invisible STX + stray literal digit
- Fixed `src/index.js` — added `repairShiftedUnicodeEscapes()`, `parseGptJson()` (parse-first, backslash-strip as fallback), `stripControlChars()` on all posted fields; verified against the real corrupted payload
- Not committed or deployed yet — pending remote choice and `.claude/`/`docs/` tracking decision

## 2026-07-07 (Tuesday)
**Log:** [sessions/2026-07-07.md](sessions/2026-07-07.md) | **Est. cost:** ~$0.45
- Deployment & cron health check — cron service active, job live, 10AM run today posted successfully (exit 0)
- Read-only diagnostic; no changes needed

## 2026-04-07 (Tuesday)
**Log:** [sessions/2026-04-07.md](sessions/2026-04-07.md) | **Est. cost:** ~$3-5
- Fixed "Bad escaped character in JSON" crash — enabled JSON response mode, added sanitizer, updated prompt format
- Deployed both changed files to DigitalOcean server via rsync
- Bootstrapped session logging (was missing)
