EAGLE RS COMPANY (Kings 2) — v3.13.1 Account Actions Menu Fix

WHAT WAS WRONG
The three-dot (Account Actions) menu was positioned inside a toolbar stacking context.
Embedded WhatsApp and Telegram webviews could paint above it, making it appear
that the menu opened under the chat or did nothing.

WHAT CHANGED
- Menu now uses Chromium's native popover top layer.
- Replaced text dots with a clean vertical three-dot SVG icon.
- Menu is positioned beside the clicked button and flips upward if necessary.
- Click outside or press Esc to dismiss; Arrow Down opens and focuses first action.
- Rename, Follow up, Remind me and Pause account retain their existing handlers.
- Webview session partition IDs, app identity and profile storage are unchanged.

INSTALL SAFELY
1. Fully QUIT EAGLE RS from the Windows system tray.
2. Copy your entire %APPDATA%\eagle-rs-workspace folder to a secure backup.
   Treat this backup as private; it includes session data.
3. Extract this ZIP to D:\EAGLE-RS-v3.13.1.
4. In PowerShell: cd D:\EAGLE-RS-v3.13.1\EAGLE-RS-Workspace-2026-Account-Menu-Fix-v3.13.1
5. Run: npm.cmd install
6. Run: npm.cmd run check
7. Run: npm.cmd run dist
8. Install dist\EAGLE RS Workspace Setup 3.13.1.exe.

This is a ready-to-build Electron project, not a precompiled Windows installer.
Live Windows/Electron and WhatsApp behavior still require verification on your PC.
