EAGLE RS WORKSPACE 3.21 — SIMPLE ACCOUNT RECOVERY
================================================

WHAT IS READY NOW
* Hotmail / Outlook linking via the Microsoft OAuth public client already configured in this personal build.
* Simple recovery screen in Settings > Security: enter your existing EAGLE RS password ONCE, select Continue with Hotmail / Outlook, verify on Microsoft's official website.
* Microsoft may request a one-time security code according to your own account settings. EAGLE RS does not send an email code, read your Microsoft password, or ask for a Resend API key.
* Later, when the SAME Microsoft account has been linked, use Continue with Hotmail / Outlook on the lock screen to verify in Microsoft's browser and unlock the workspace WITHOUT resetting the local password.
* If you forgot the EAGLE RS password, use the separate Reset using Microsoft link on the lock screen after verifying the same account. Save the new offline recovery codes.
* Working offline backup recovery codes continue to be supported.
* An optional encrypted OneDrive SETTINGS backup is available from the advanced recovery options. It does NOT back up WhatsApp/Signal/Telegram chats, provider cookies or linked-device sessions.

GOOGLE STATUS
* OAuth Desktop/PKCE browser sign-in, same-identity unlock, and recovery are implemented and locally tested, but Google sign-in is intentionally disabled until this software publisher registers a real Google OAuth Desktop client and puts its PUBLIC Client ID in google-auth-config.json BEFORE the Windows build.
* Do not paste a Google password, client secret, or personal credential into EAGLE RS.
* Users of this build need NO Google developer setup. Continue with Microsoft / Hotmail works with the existing configured Microsoft application.

DIRECT EMAIL CODES
* A direct 'send me an email code' service has NOT been deployed because this application has no trusted email-delivery backend. This build does not promise it sends messages. Microsoft's sign-in may ask you for its own email verification code.

HOW TO INSTALL
1. Fully quit EAGLE RS from the Windows tray.
2. Copy the complete %APPDATA%\eagle-rs-workspace folder to a safe offline backup (including Partitions and lock records).
3. Extract the ZIP into D:\EAGLE-RS-v3.21.
4. Open PowerShell in the extracted project folder and run:
      npm.cmd install
      npm.cmd run check
      npm.cmd run dist
5. Open dist and install the generated EAGLE RS Workspace Setup 3.21.0.exe.
6. Unlock with your EXISTING EAGLE RS master password. Go to Settings > Security > Easy account recovery.
7. Enter that EAGLE RS password in the local confirmation field and link Hotmail / Outlook. Complete Microsoft's device-login code in the official browser.
8. IMPORTANT: Confirm 'Microsoft linked' before depending on it for a forgotten password. Preserve your existing offline recovery codes.

SECURITY AND DATA
* App ID com.eaglers.workspace and WhatsApp/Telegram partition naming were not changed.
* Provider login sessions can expire or be revoked; email recovery only changes the EAGLE RS workspace lock, not service sign-ins.
* No application can guarantee that a lost phone-linked session can be restored from email alone.
* Live Microsoft/Google authentication and Windows installer remain to be tested on the target PC.
* Never send anyone your Microsoft verification code, account password, EAGLE RS passphrase, Gemini key or recovery codes.
