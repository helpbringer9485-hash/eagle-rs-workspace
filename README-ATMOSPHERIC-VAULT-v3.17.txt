EAGLE RS COMPANY (Kings 2) — Atmospheric Vault v3.17.0

CHANGELOG
- Replaces blue window / tray / toast branding with coordinated themed gold (default), silver, green or sapphire eagle icon art.
- Adds full-window themed marble veining and slowly drifting ambient light to the locked/startup screen. Motion is limited to three compositor-friendly layers. It never animates or styles third-party chat pages.
- Reuses the working master passphrase, verified-email recovery if previously enrolled, and one-time recovery codes. No biometric unlock is claimed or introduced.
- Themes are based on the existing six-theme picker and are saved in the existing encrypted UI settings. Motion can be disabled in Settings > Appearance, or with Windows Reduced Motion.
- Retains existing account partition naming, app ID and userData folder. No cache clearing or re-scanning code is introduced.
- EAGLE RS does NOT collect Signal call histories or guarantee end-to-end encryption of the full Chromium browser profile. Windows BitLocker/Device Encryption remains recommended.

BEFORE INSTALLING
1. Fully close EAGLE RS including its tray icon.
2. Back up %APPDATA%\eagle-rs-workspace to a safe external location while the app is closed.
3. Keep the previous installer/backups until all WhatsApp/Telegram profiles are verified.

BUILD IN WINDOWS POWERSHELL
  npm.cmd install
  npm.cmd run check
  npm.cmd run dist

After successful build, open the dist folder and run EAGLE RS Workspace Setup 3.17.0.exe.

WINDOWS VALIDATION CHECKS
- Open, lock/unlock with existing passphrase, and verify one recovery method without consuming recovery codes.
- Switch between all six themes, lock, ensure art, backdrop and system tray icon match.
- Switch to Windows Reduced Motion or disable the new appearance toggle and confirm movement stops.
- Check Windows notifications (Windows can cache a previous Start-menu icon; reinstallation or refreshing the shortcut may be needed).
- Open WhatsApp and Telegram accounts and ensure partitions remain logged in, subject to provider reauthentication.
- Test on a laptop at 125% / 150% scaling and while 13 accounts are loaded. No Windows build or live calls have been tested on this Linux machine.
