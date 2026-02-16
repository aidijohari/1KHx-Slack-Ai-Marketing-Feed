# 1KHx Slack AI Marketing Feed

Fetches marketing/AI/automation articles, scores them with GPT, and posts the top picks to Slack with threaded feedback prompts and reactions. Dedupes against a Google Sheet to avoid reposts and logs runs per day.

## How it works
- Fetch RSS feeds (shuffled; per-feed cap derived from the max, default 50), blocklist a feed for the run on 403 extraction errors, skip items older than 60 days.
- Prepare prompt with fresh (non-duplicate) articles and call OpenAI.
- Parse GPT JSON (accepts top-level array or wrapped under `results`/`articles`).
- Post the top article to Slack (one message), add reactions from `config.slack.postReactions` in order, and add a thread prompt using the same configured reactions.
- Append posted articles to Google Sheet (normalized URLs) with Slack metadata for dedupe.

## Key config
- `.env`: Slack token/channel/error recipients, OpenAI keys/model, Google Sheets IDs and creds path.
- `config.js`: feeds list, GPT model, lookback window (60 days), delay between posts (config.settings.delay), Slack bot name/reactions.

## Scripts
- `npm start`: run app once (no log wrapper).
- `npm run start:cron`: uses `run.sh` to log to `logs/YYYY-MM-DD.log`.
- `run.sh`: logging wrapper; creates `logs/`, appends output with timestamps, preserves exit code.

## Logging
- `logs/YYYY-MM-DD.log`: per-run output when using `run.sh`/`start:cron` or the cron hook below.
- Cron ping log: `/opt/1khx-marketing-slack-bot/logs/cron-ping.log` (rotated to 14 lines).

## Production details
- Host: `170.64.159.17`
- User: `app`
- App location: `/opt/1khx-marketing-slack-bot`
- Run script: `/usr/local/bin/1khx-marketing-slack-bot-run`

Cron (Melbourne time):
```
# Run at 10:00am Melbourne time, Mon–Fri
TZ=Australia/Melbourne
0 10 * * 1-5  flock -n /tmp/1khx-marketing-slack-bot.lock /usr/local/bin/1khx-marketing-slack-bot-run

# Keep cron ping log short (14 lines)
0 10 * * 1-5 ( echo "cron ping $(TZ=Asia/Kuala_Lumpur date -Is) user=$(whoami)"; tail -n 13 /opt/1khx-marketing-slack-bot/logs/cron-ping.log 2>/dev/null ) | tac | tac > /opt/1khx-marketing-slack-bot/logs/cron-ping.log.tmp && mv /opt/1khx-marketing-slack-bot/logs/cron-ping.log.tmp /opt/1khx-marketing-slack-bot/logs/cron-ping.log

# Cleanup old app logs (older than 14 days)
30 9 * * * find /opt/1khx-marketing-slack-bot/logs -maxdepth 1 -type f -name "*.log" -mtime +14 -delete
```

Run script (`/usr/local/bin/1khx-marketing-slack-bot-run`):
```
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/1khx-marketing-slack-bot"
ENV_FILE="/home/app/.secrets/1khx-marketing-slack-bot/.env"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/$(TZ=Australia/Melbourne date +%Y-%m-%d).log"

cd "$APP_DIR"
mkdir -p "$LOG_DIR"

# Load env vars for cron context
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
else
  echo "ERROR: Env file not found: $ENV_FILE" >> "$LOG_FILE"
  exit 1
fi

# Node for cron (pin exact node version)
export PATH="/home/app/.nvm/versions/node/v22.22.0/bin:$PATH"

echo "=== $(TZ=Asia/Kuala_Lumpur date -Iseconds) start ===" | tee -a "$LOG_FILE"
node src/index.js 2>&1 | tee -a "$LOG_FILE"
exit_code=${PIPESTATUS[0]}
echo "=== $(TZ=Asia/Kuala_Lumpur date -Iseconds) end (exit $exit_code) ===" | tee -a "$LOG_FILE"
exit "$exit_code"
```

## Sheets dedupe
- Reads normalized URLs from Google Sheet (default worksheet "Articles").
- Skips already-posted URLs before GPT and before Slack posting.
- Normalizes and appends URLs + Slack metadata back to the sheet.

## Slack posting
- One message per run (top article), sequential reactions from `config.slack.postReactions`, thread reply asking for feedback with those same emojis.
- If Slack rejects an image block, the message is retried without the image.
- Fields: title, publisher, URL, dates, key takeaway, insights, why it matters, why for 1000heads.

## Resilience & validation
- Skips feeds that return 403 on extraction for the rest of the run.
- Validates GPT output shape; if empty/invalid, logs and notifies error recipients.
- If Sheets creds missing/unreadable, logs/notifies and skips dedupe for that run.

## Operations
- Manual run: `npm start`
- Cron/logged run: `npm run start:cron` (or `/usr/local/bin/1khx-marketing-slack-bot-run` via cron)
- Logs rotate via cron cleanup (older than 14 days).
