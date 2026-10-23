EAGLE RS Workspace v3.12.0 — Premium Interface Refactor

WHAT CHANGED
- Real Obsidian Gold shell polish with consistent spacing and typography.
- Four quick status cards visible; Overview expands the remaining cards.
- Account actions now sit in a fixed right-aligned ellipsis dropdown.
- 2 account-density modes (Settings > Appearance), saved in existing encrypted configuration.
- Sidebar group hide/reopen remains non-destructive and preserves webviews.
- Gemini panel remains optional and collapsible.
- Keyboard: Ctrl+K focus account search; Ctrl+Shift+F toggle full-screen profile; Ctrl+Shift+L lock.
- Reduced GPU-heavy blur effects from account lists, card grid, sidebar and chat workspace shell.
- EAGLE RS does not change WhatsApp, Telegram or Signal's native chat layouts.

BUILD ON WINDOWS
1. Exit old EAGLE RS fully, including Windows tray.
2. Back up %APPDATA%\eagle-rs-workspace and keep it secure.
3. Extract this project to D: or another trusted folder.
4. In PowerShell open project folder and run: npm.cmd install; npm.cmd run check; npm.cmd run dist
5. Run generated dist\EAGLE RS Workspace Setup 3.12.0.exe
6. Verify WhatsApp 1 login and account switching before deleting any backup.

LIMITS & SECURITY
- This is source ready to build, not a precompiled or audited Windows binary.
- Do not run untrusted Electron source as administrator.
- All 13 simultaneous webviews can still consume substantial RAM.
- Low RAM mode stops background views; leave it off if all accounts must receive activity.
- Telegram Web may require reauthentication; Signal multi-instance operation remains unverified.
- Session names/appId/userData paths remain unchanged. No cached session data is cleared by this upgrade.
- Provider calls and missed-call histories cannot be reliably synchronized in this app.
