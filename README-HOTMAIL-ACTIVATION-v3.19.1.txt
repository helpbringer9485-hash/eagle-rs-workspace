EAGLE RS Workspace 3.19.1 — Hotmail / Outlook activation fix
===========================================================

WHY CONNECT LOOKED BROKEN
The previous v3.19 package shipped with an EMPTY public OAuth Application
(client) ID in microsoft-auth-config.json. The Connect button was disabled
until a developer manually edited that bundled file and rebuilt the app.
The window title also incorrectly said Living Smoke v3.18.0.

WHAT CHANGED
- If activation is missing, Connect becomes 'Set up Microsoft sign-in'.
- A guided setup section explains the required Microsoft registration.
- You can paste a PUBLIC Application (client) ID while unlocked, verify your
  existing EAGLE RS master passphrase, and save it. NO second build is needed.
- The public ID is stored under EAGLE RS userData in microsoft-public-client.json.
- A real Microsoft device-code login remains necessary to verify Hotmail.
- The old Resend form is not required for this newer recovery option.
- The app window title now correctly shows Hotmail Activation v3.19.1.
- No existing WhatsApp/Telegram/Signal session folders are intentionally changed.

HOW THE OWNER ACTIVATES THE BUTTON (ONCE)
1. Rebuild/install this version, and unlock EAGLE RS with existing master passphrase.
2. Open Settings > Security > Link Hotmail or Outlook.
3. Click 'Set up Microsoft sign-in'.
4. The developer/publisher of this application must register a Microsoft Entra
   public/native desktop app for personal Microsoft accounts and enable device-
   code/public-client authentication. This uses an Application (client) ID, NOT
   your Hotmail address. Microsoft registration may require Entra tenant access.
   Guide: https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
   Required delegated Graph permissions: User.Read; Files.ReadWrite.AppFolder
   (verify availability), offline_access. No client secret. If you are not the
   publisher, ask the publisher to provide this public application ID.
5. Enter the PUBLIC UUID in the 'Microsoft Application (client) ID' field.
6. Enter your CURRENT EAGLE RS master passphrase in the field above.
7. Click 'Save ID and enable Connect', then 'Connect Hotmail / Outlook'.
8. Microsoft opens an official web sign-in page and EAGLE RS displays a device
   code. Sign in to Microsoft in the browser. Never paste Microsoft passwords
   or Microsoft 2FA codes into this application's settings.
9. The linked identity is stored using Windows-protected app data when available.
   Future email recovery requires the SAME Microsoft account.

LIMITATIONS
- Microsoft identity sign-in is not activated just by installing this source.
- OneDrive backups include only app settings, reminder templates and labels;
  they DO NOT include WhatsApp messages, Signal chat histories, live QR sessions,
  provider call records, or expired sessions. Keep an independent, protected
  backup of the app profile for disaster recovery.
- Device-code authentication needs real Microsoft network access and working
  application consent; the included tests use simulated Microsoft requests.
- If you can't register a Microsoft app, retain the existing master passphrase
  and offline recovery codes until the publisher activates it.

BUILD / TEST
Close EAGLE RS (including tray), back up %APPDATA%\eagle-rs-workspace, then:
  npm.cmd install
  npm.cmd run check
  npm.cmd run dist
Installer output: dist\EAGLE RS Workspace Setup 3.19.1.exe

SECURITY
The public client ID is intentionally not an OAuth secret. Do not enter or
share a Hotmail password, a secret key, a device code or an existing recovery
code in chat. The code checks protect against overwriting a linked account's
OAuth registration without first unlinking it. This is NOT a guarantee against
all malware, lost Windows profiles or provider-specific logouts.
