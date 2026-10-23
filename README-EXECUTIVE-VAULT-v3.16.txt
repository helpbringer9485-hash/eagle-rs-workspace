EAGLE RS WORKSPACE v3.16.0 — EXECUTIVE VAULT LOCK SCREEN

This version changes only the app-shell lock/startup view and the release label.
It retains all account IDs, session partition names, IPC passphrase verification, recovery methods, and saved preferences.

IMPORTANT: Back up %APPDATA%\eagle-rs-workspace first, and fully exit the app from the Windows tray.
Build on Windows: npm.cmd install ; npm.cmd run check ; npm.cmd run dist
Find the installer in the dist directory.

The screen includes an Eagle emblem, Obsidian Gold two-column layout, local live clock, software overview, password show/hide toggle, reset-by-preconfigured-recovery methods. It does NOT grant face/fingerprint authentication automatically. No security bypass exists in the UI.

Electron safeStorage protects supported app settings; browser cookies and service databases require OS-level drive protection (BitLocker) and secure Windows sign-in. Re-authentication may still be requested by messaging services.
