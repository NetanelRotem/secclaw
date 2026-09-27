---
name: notify
description: Send the owner a Telegram message from a script, background job or cron. Use for reminders, scheduled reports, or alerts when a long task finishes.
---

# Notify

`TELEGRAM_BOT_TOKEN` and `SECCLAW_CHAT_ID` are set in your shell environment.

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d chat_id="$SECCLAW_CHAT_ID" --data-urlencode text="MESSAGE"
```

Cron and `at` jobs do not inherit your environment. Write the token and chat id into the job itself, e.g. in a script at `workspace/jobs/NAME.sh`:

```bash
(crontab -l 2>/dev/null; echo "0 9 * * * $PWD/jobs/NAME.sh") | crontab -
```

List jobs with `crontab -l`. Remove them by editing that list.

On Windows there is no cron. Use `schtasks //Create //TN NAME //SC DAILY //ST 09:00 //TR "bash -c '...'"` from Git Bash (double slashes stop Git Bash from rewriting the flags).
