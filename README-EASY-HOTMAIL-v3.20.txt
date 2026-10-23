EAGLE RS Workspace v3.20.0 — EASY MICROSOFT RECOVERY
====================================================
This personalized build includes the PUBLIC Microsoft Application (client) ID registered by
this workspace owner. It is not a secret. Public client/device-code flows must remain
allowed in their Entra application registration. Personal Microsoft accounts only.

FIRST-TIME LINKING (ONLY WHILE UNLOCKED)
1. Install this version WITHOUT removing your prior EAGLE RS user data folder.
2. Unlock with your existing EAGLE RS master password.
3. Settings > Security > Easy recovery with Hotmail or Outlook.
4. Re-enter your CURRENT EAGLE RS password in the visible field, then click
   Link my Hotmail / Outlook. This authorization prevents someone who uses your
   unlocked PC from changing your recovery identity unnoticed.
5. EAGLE RS displays a ONE-TIME DEVICE CODE and opens Microsoft's website.
   Type that code on Microsoft's official sign-in page, and authenticate
   directly with Microsoft. The code is NOT an email OTP sent by EAGLE RS.
6. When Microsoft's account verification finishes, EAGLE RS shows the linked
   identity. DO NOT uninstall EAGLE RS or erase AppData afterward.

LATER RECOVERY
On the lock screen, Recover with Microsoft (shown ONLY IF previously linked)
opens the recovery verification. Use the SAME Microsoft account. You have a
short time after verification to choose a new EAGLE RS master passphrase.
Existing offline backup recovery codes remain an alternative.

CLOUD BACKUP (SEPARATE AND OPTIONAL)
Only encrypted settings, labels, reminder notes and templates are included,
NOT message databases, call histories, active sessions, WhatsApp/Telegram
cookies, or Signal app data. Existing partitions and profile paths are left
untouched. Backup is OFF until you opt in. Restore cannot magically recover
phone-linked messaging sessions, expired logins or lost DPAPI secrets.

SECURITY
- Never share Hotmail password, Microsoft sign-in code, master password, or
  recovery codes with anybody, including support or ChatGPT.
- Real-time live sign-in has not been verified in the user's Microsoft tenant
  by the build/test environment. The UI and mocked identity tests are local.
- No built-in email-OTP sender exists; the OAuth Device Code flow is secure
  and avoids using SMTP/Resend secret keys on a desktop computer.
- Always back up %APPDATA%\eagle-rs-workspace before upgrading and fully exit
  EAGLE RS in the system tray before installing the update.
- Windows PowerShell build: npm.cmd install; npm.cmd run check; npm.cmd run dist
