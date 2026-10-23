EAGLE RS COMPANY (Kings 2) — Living Smoke + Transparent Eagle v3.18.0
===================================================================
REAL animated smoke, not a static image
- living-smoke.webm is an 8-second actual VP9 WebM video (silent, ~600 KB).
- The lock/startup screen displays and seamlessly loops the smoke video.
- The Electron renderer starts it ONLY when the lock screen is visible.
- Video pauses immediately when the workspace unlocks, minimizes, or loses visibility.
- Settings > Appearance > Live smoke video controls the opt-out; Windows Reduce Motion also disables it.
- No smoke animation is inserted in WhatsApp, Telegram, or Signal content.
- Playback fallback: if the system cannot decode VP9 WebM, the theme's static premium background remains. Unlock always works.

TRANSPARENT desktop icon and native notifications
- eagle-rs.ico is an RGBA multi-resolution (16 to 256 px) Windows icon.
- The eagle has no opaque square/background tile. All 6 themes have matching tray and notification art.
- Windows can cache the old desktop icon. After installing, delete ONLY the old EAGLE RS desktop shortcut,
  then recreate the shortcut from the newly installed program (Start > EAGLE RS Workspace > Open file location).
  Do NOT delete %APPDATA%\eagle-rs-workspace or your browser session partitions.

SAYDOCK
- SayDock is a SEPARATE application and controls its own docking/always-on-top behavior.
- SayDock's published release notes mention Telegram Desktop compatibility. Use current SayDock and its own
  dock/auto-attach options for Telegram Desktop. EAGLE RS cannot force SayDock to float above every provider webview.
- SayDock homepage: https://saydock.com/ ; download: https://www.saydock.com/download.html
- For ordinary windows, Windows Snap or optional PowerToys Always On Top may help, but not every window supports it.

BUILD A WINDOWS INSTALLER
1) Completely quit EAGLE RS in Windows system tray.
2) Back up your entire existing %APPDATA%\eagle-rs-workspace directory first.
3) Unzip to D:\EAGLE-RS-v3.18\ and in PowerShell:
   cd "D:\EAGLE-RS-v3.18\EAGLE-RS-Workspace-2026-Living-Smoke-v3.18.0"
   npm.cmd install
   npm.cmd run check
   npm.cmd run dist
4) Use dist\EAGLE RS Workspace Setup 3.18.0.exe only after build completes.
5) Verify your saved WhatsApp login before removing the old installer/backup.

UNCHANGED SECURITY AND ACCOUNTS
- com.eaglers.workspace app ID, Electron userData path, WhatsApp/Telegram persistent partition IDs,
  recovery settings, and master-passphrase implementation are unchanged.
- Updating appearance does not intentionally clear cookies, IndexedDB, or messages.
- Messaging providers can still request a QR scan; no app can guarantee sessions never expire.
- Signal account slots do not prove independently linked Signal Desktop logins.

VERIFICATION
- npm run check source/security/session tests passed in build environment.
- Browser-rendered isolated preview confirmed looping video time advances and reduces motion visually.
- WebM checked with ffprobe and native icon corners are transparent.
- Windows installer could not be built/tested in this Linux environment; it must be built and smoke-tested on a Windows PC.
