EAGLE RS WORKSPACE v3.19.0 - START HERE
=====================================

This is a ready-to-build Windows ELECTRON SOURCE project, not a prebuilt .exe.

WHAT CHANGED
- Settings > Security > Link Hotmail or Outlook (uses Microsoft's browser sign-in)
- Locked screen > Forgot passphrase > verify the previously linked Microsoft account
- Optional OneDrive backup and restore of EAGLE RS SETTINGS/ACCOUNT LABELS only
- Old Resend sender/domain API-key setup is no longer required for new users
- Existing one-time recovery codes and previously enrolled legacy email recovery retained
- Existing app ID, master lock file and WhatsApp/Telegram session partition IDs unchanged

IMPORTANT - PROVIDER ACTIVATION
A MICROSOFT OAuth public-client Application (client) ID MUST be registered by
whoever publishes EAGLE RS before the Hotmail link button becomes active.
Instructions: README-MICROSOFT-RECOVERY-v3.19.txt. Do not paste a client secret.
Without this activation, offline recovery codes still work, but EAGLE RS
CANNOT verify a Hotmail account. This is a genuine security boundary.

INSTALL / BUILD ON WINDOWS
1. Completely EXIT the previous EAGLE RS app, including its system tray icon.
2. Safely copy your %APPDATA%\eagle-rs-workspace directory to offline storage.
   Do not share it; it may contain session cookies.
3. Extract this project into a NEW folder (for example D:\EAGLE-RS-v3.19).
4. Open Windows PowerShell inside this source folder:
      npm.cmd install
      npm.cmd run check
      npm.cmd run dist
5. Run the generated EAGLE RS Workspace Setup 3.19.0.exe inside dist.
6. Open EAGLE RS, unlock with your EXISTING master passphrase, and open
   Settings > Security.

KEEP BACKUPS
Do not delete the prior installation's user-data folder or assume email
restores WhatsApp/Signal sessions. OneDrive backup does not include provider
message databases, QR login tokens or Signal profile directories. Provider
linking may still need to be repeated on a new Windows computer.
