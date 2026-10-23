EAGLE RS Workspace v3.19.0 - Hotmail / Outlook recovery & OneDrive SETTINGS backup
================================================================================

WHY THIS CHANGE
---------------
The earlier Resend workflow required the *end user* to create an email-sending
account, verify a domain and enter an API key. This release introduces an
alternative: a genuine Microsoft personal-account sign-in with device-code
verification in Microsoft's own browser. EAGLE RS NEVER requests or handles
Microsoft account passwords or Microsoft MFA codes.

IMPORTANT: ONE-TIME DEVELOPER ACTIVATION REQUIRED
-------------------------------------------------
Email login cannot be securely verified by a local Electron app without a
trusted identity provider AND an application registration. No secretless,
registration-free implementation could legitimately prove that a Hotmail
address belongs to the user. For the developer distributing EAGLE RS:

1. Register a new application in Microsoft Entra (App registrations).
2. Supported account types: Personal Microsoft accounts (consumer Outlook,
   Hotmail, Live.com) - optionally consumer + work/school accounts if desired.
3. Enable the Microsoft public-client/device-code flow. No client secret.
4. Add Microsoft Graph delegated permissions User.Read and
   Files.ReadWrite.AppFolder (application-folder feature may be in preview),
   with offline_access for token refresh. Test consent with a personal account.
5. Copy the public "Application (client) ID" UUID into
   microsoft-auth-config.json in the clientId field BEFORE running npm run dist.
6. Rebuild and deploy the Windows app. The developer does this ONCE; the user
   should not need to touch Microsoft Entra or obtain any API key.

If no client ID is configured the app truthfully reports that Microsoft sign-in
has not been activated. Existing recovery codes remain available. Do NOT paste
random IDs, other companies' OAuth client IDs, or client secrets.

USER FLOW
---------
1. Unlock EAGLE RS with current master passphrase.
2. Settings > Security > Link Hotmail or Outlook.
3. Enter CURRENT EAGLE RS passphrase and click Connect Hotmail / Outlook.
4. Microsoft's official sign-in page opens; enter the device code shown by
   EAGLE RS and authenticate using your Microsoft account (MFA recommended).
5. Once linked, future lock-screen "Forgot passphrase" offers verification
   with the SAME Microsoft account. A verified session authorizes a new local
   master passphrase for 5 minutes and returns new recovery codes.
6. Settings > Security > Turn on automatic OneDrive BACKUP OF SETTINGS
   if you want cloud backup. It is OFF by default and can be disabled.

WHAT GETS BACKED UP
-------------------
App account identifiers/names, local UI preferences, templates, reminders, and
manual notes. It is an encrypted JSON snapshot in the user's Microsoft OneDrive
application folder, with a separate convenience recovery key in that SAME
folder. This is encrypted against casual exposure but is NOT end-to-end or
zero-knowledge encryption against someone who controls the OneDrive account;
MFA and good Microsoft security are essential.

WHAT DOES NOT GET BACKED UP
---------------------------
WhatsApp/Telegram browser cookies, IndexedDB, provider call history, WhatsApp
or Signal conversations, Signal app profile directories, or provider credentials.
Those are stored in platform-specific databases, some tied to the old Windows
DPAPI user profile. A master-password reset never restores or revokes provider
sessions. Following PC loss or reinstall, you may need to re-link WhatsApp,
Telegram and Signal directly with their official services.

For full recovery, KEEP SEPARATE BACKUPS of your Windows user profile and
%APPDATA%\eagle-rs-workspace, made with all messaging apps fully closed. The
full profile may be large and may contain highly sensitive session material.
Protect such backups with BitLocker, Windows account security, offline media,
and never send them as ordinary email attachments.

SECURITY / TROUBLESHOOTING
--------------------------
- Microsoft account matching uses the stable Microsoft Graph account ID, not
  arbitrary text typed into an email box.
- Login tokens / linked identity are protected by Electron safeStorage on the
  current Windows user account, where available. No tokens go to webviews.
- Changing the local master passphrase does not wipe saved account folders.
- No sign-in provider can promise that all messaging sessions persist forever.
- During a new-PC restore, create a new local passphrase, link the SAME
  Microsoft account, then Check cloud backup and Restore saved settings.
- All OneDrive operations require Internet access, valid app permissions and
  available OneDrive storage; errors are shown rather than hidden.
- `npm run check` tests the authentication state machine and fake OneDrive
  network responses, not a live production Microsoft tenant or an EXE build.
- To produce a Windows installer: run `npm.cmd install`, `npm.cmd run check`,
  and `npm.cmd run dist` on Windows. DO NOT uninstall/delete old app data first.

This update does NOT guarantee recovery from a destroyed profile, ransomware,
Microsoft account compromise, disk corruption or provider-side logout.
