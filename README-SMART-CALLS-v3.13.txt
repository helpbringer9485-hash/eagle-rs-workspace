EAGLE RS Workspace v3.13.0 - Smart Call Activity Center

WHAT THIS VERSION ACTUALLY DOES
- Keeps original app ID com.eaglers.workspace and existing session partitions.
- Records incoming/ringing, answered, missed, declined, outgoing, ended statuses ONLY after you confirm them.
- Supports copying a short call notice from WhatsApp/Telegram into the app and suggesting a status (not verified telemetry).
- Shows caller, platform, account, date, type, outcome, callback status and optional notes.
- Allows reminders and transitions, and calculates duration only from user-entered transition timestamps.
- Allows official WhatsApp and Telegram web notifications after opt-in, subject to their services and Windows.
- Signal Desktop calls are managed by Signal; multiple launcher slots are not independently verified accounts.

WHAT THIS VERSION DOES NOT DO
- It cannot automatically scrape or read every WhatsApp, Signal or Telegram call; these consumer clients do not publish a supported common call event API.
- It never claims an unanswered notification is a missed call or records a caller it cannot identify.
- It does not record call audio or screen content.
- Provider call history can differ from the local journal.

BACKUP BEFORE INSTALL
Close EAGLE RS fully from the tray. Back up the complete %APPDATA%\eagle-rs-workspace folder. Do NOT delete / reinitialize Partitions, Cookies, IndexedDB or your password/encryption files.

BUILD ON WINDOWS
PowerShell in this folder: npm.cmd install ; npm.cmd run check ; npm.cmd run dist
After a successful build, install dist\EAGLE RS Workspace Setup 3.13.0.exe.
Verify WhatsApp 1 and Telegram first.

PERFORMANCE
The app keeps Always On enabled by default; many simultaneously active sessions consume RAM. Use optional Low RAM mode only if you're willing to pause other accounts in the background.
