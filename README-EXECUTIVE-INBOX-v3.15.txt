EAGLE RS COMPANY (Kings 2) - v3.15 Executive Inbox and Premium Navigation

CHANGES
- Real, readable account names in the left navigation (rather than tiny icon-only grid)
- One-click notification inbox with WhatsApp, Telegram, Signal reminder, and follow-up filters
- Top KPI row, polished Gold styling, and cleaner toolbar
- No automatic parsing of private chats, no invented unread Signal counts
- Workspace account partitions, master passphrase, and recovery settings preserved

CAUTIONS
Provider web pages and call histories cannot be restyled or read automatically by the shell. Live provider calls and session state must be verified on Windows. Do not install multiple copies simultaneously.

BUILD WINDOWS
1. Completely quit EAGLE RS from the system tray.
2. Back up %%APPDATA%%\eagle-rs-workspace first.
3. npm.cmd install
4. npm.cmd run check
5. npm.cmd run dist
6. Open dist\EAGLE RS Workspace Setup 3.15.0.exe.

The source package is not a prebuilt .exe. Do not delete old profile data.
