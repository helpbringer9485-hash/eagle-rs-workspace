EAGLE RS Workspace 3.14 — Executive Startup & Timed Popups
================================================================

WHAT CHANGED
- Real Obsidian Gold startup/lock screen with neural eagle artwork, quiet animation,
  live LOCAL device time/date, product overview, and improved master passphrase input.
- Existing security, first-time passphrase setup, one-time recovery codes and optional
  pre-enrolled verified email recovery are reused; recovery is not created automatically.
- Top-right workspace metric/detail drawers close after 1, 2, or 3 minutes (default: 1).
- Account actions (three-dot) menu closes after the same period. Timer pauses while
  the user is actively reading/hovering/focusing the popup so it does not dismiss mid-click.
- Auto-dismiss never applies to Settings, master lock, account editor, unsent chats,
  or security forms. Native Windows notifications are controlled by Windows, not this timer.
- The six existing themes and account partition identifiers remain unchanged.

IMPORTANT LIMITATIONS
- The shown clock is the local Windows device clock, not a remote server's time.
- 'Security' means an app password and encrypted app settings where supported. Chromium
  WhatsApp/Telegram logins are NOT individually encrypted by that app setting; use
  Windows BitLocker/Device Encryption to protect at-rest profile storage.
- Signal Desktop launchers are NOT verified independently authenticated Signal sessions.
- WhatsApp/Telegram content belongs to their official providers and has its own theme,
  message privacy/security settings, and possible reauthentication requirements.
- The feature does not promise zero crashes, unlimited active memory, or no logouts.
- Call information is NOT imported directly from the official providers.

INSTALLATION
1. Fully quit the running EAGLE RS application, including its Windows tray icon.
2. Back up ALL of %APPDATA%\eagle-rs-workspace to a separate folder, including its
   Partitions directory. Do not overwrite the backup with empty default data.
3. Extract the source ZIP to D:\EAGLE-RS-v3.14\, then open Windows PowerShell.
4. cd D:\EAGLE-RS-v3.14\EAGLE-RS-Workspace-2026-Executive-Startup-v3.14.0
5. npm.cmd install
6. npm.cmd run check
7. npm.cmd run dist
8. Open dist\EAGLE RS Workspace Setup 3.14.0.exe and install.
9. Launch the app and unlock with your current master password. Verify WhatsApp 1,
   Telegram 1, and your previously saved accounts BEFORE removing older app versions.

POPUP SETTINGS
Settings > Appearance and privacy > Automatically close temporary panels
Choose 1, 2 or 3 minutes. The preference is saved with existing encrypted settings.

TEST STATUS
The source checks can run on Windows with 'npm.cmd run check'. Live provider
notifications, real session continuity, and installer operation must be tested on
that Windows PC. No users' personal profiles, passwords, or session files are bundled.
