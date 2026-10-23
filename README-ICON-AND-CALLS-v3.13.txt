EAGLE RS COMPANY (Kings 2) v3.13.0 – Smart Call Center & Professional Chevron Update

NEW
- Consistent CSS-drawn WhatsApp/Signal/Telegram dropdown chevrons (no unreliable text glyphs).
- Fast, accessible group expand/collapse with descriptive screen-reader labels.
- Matching background Sessions drawer chevron.
- Call Activity Desk: paste a call notification to suggest Incoming/Missed/Answered/Ended; manually verify before saving. Does NOT automatically access provider call history or listen to calls.
- Preserve the previous application ID, saved webview partitions, security settings, and profile metadata.

SAFETY AND REAL LIMITATIONS
- Keep a separate complete backup of %APPDATA%\eagle-rs-workspace before updating. Fully exit the previous app first.
- Provider webviews are intentionally not modified to avoid breaking chats.
- Ten or more simultaneous WhatsApp webviews may consume significant RAM. No build can guarantee zero lag.
- Official Signal Desktop does not expose an integrated multi-account call/event API to this launcher.
- The app protects settings with Windows OS keys when available; Chromium cookies/IndexedDB are not all separately encrypted by the app. Enable BitLocker or Device Encryption for drive-at-rest protection.
- Do not delete existing partitions or account data to fix login troubles.

BUILD ON WINDOWS (PowerShell in this folder):
    npm.cmd install
    npm.cmd run check
    npm.cmd run dist

The setup file is in dist\EAGLE RS Workspace Setup 3.13.0.exe.
Installer and actual provider call/notification behavior still require testing on Windows.
