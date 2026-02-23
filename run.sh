  #!/usr/bin/env bash
  set -euo pipefail
  cd /path/to/1KHx-Slack-Ai-Marketing-Feed

  mkdir -p logs
  log_file="logs/$(date +%Y-%m-%d).log"

  echo "=== $(date -Iseconds) start ===" | tee -a "$log_file"
  node src/index.js 2>&1 | tee -a "$log_file"
  exit_code=${PIPESTATUS[0]}
  echo "=== $(date -Iseconds) end (exit $exit_code) ===" | tee -a "$log_file"
  exit "$exit_code"