EAGLE RS Workspace v3.22.0 — NORMAL MICROSOFT SIGN-IN
=======================================================
WHY THIS CHANGE
A screen recording of v3.21 shows that Microsoft rejected the 8-character device
code shown inside EAGLE RS, even though the user typed the same code. The
specific server-side reason was not visible in the recording. This update
REPLACES manual device-code entry in the shipped Windows app with Microsoft's
OAuth authorization-code browser flow using PKCE and a localhost callback.

ONE-TIME APP REGISTRATION STEP (ALREADY HAVE CLIENT ID)
1. Open https://entra.microsoft.com and select App registrations.
2. Select EAGLE RS Workspace (existing registration; do NOT create a new app).
3. Authentication (Preview) > Redirect URI configuration > Add Redirect URI.
4. Select Mobile and desktop applications. Enter this EXACT Custom redirect URI:

   http://localhost

5. Click Configure / Save. Keep 'Allow public client flows' enabled on Settings.
6. Do not create a client secret. Do not share your Hotmail password or token.

AFTER THIS ONE-TIME STEP
1. Fully close the previous EAGLE RS (including tray) and back up:
   %APPDATA%\eagle-rs-workspace
2. Double-click BUILD-WINDOWS.bat in the extracted project folder. The builder
   needs Node.js LTS and npm; it creates an installer under dist on success.
   A Windows installer EXE is NOT included in this ZIP.
3. Install v3.22.0, unlock with the EXISTING EAGLE RS master password.
4. Settings > Security > Easy account recovery > enter that EAGLE RS password once.
5. Click Continue with Hotmail / Outlook. Your default browser opens.
6. Sign in on Microsoft's actual website with YOUR personal account, accept
   requested permission and return to EAGLE RS. No device code entry is needed.
7. Confirm the app displays 'Microsoft linked' before relying on recovery.
8. If you later forget the EAGLE RS master password, choose Reset with Microsoft
   on the lock screen and verify the SAME Microsoft identity. Choose a new EAGLE
   RS password and securely save the new offline recovery codes.

TROUBLESHOOTING
* AADSTS50011 / redirect mismatch: The http://localhost redirect URI was not
  registered on the SAME Microsoft Entra app. Check step 4. Do not choose SPA/Web.
* Browser hangs: Microsoft may not redirect to the local EAGLE RS process due to
  a firewall, browser/network proxy, or localhost issue. Cancel / try again.
* Google: Its OAuth Desktop Client ID is EMPTY. Google sign-in is hidden, NOT working.
* Direct email codes: EAGLE RS has no trusted email-delivery server for codes.
* Password didn't change: Merely linking a provider MUST NOT change your password.
  A separate reset must be fully verified and completed to change it.
* Messaging data: this source update keeps app ID and saved partition IDs;
  cloud settings backup cannot restore revoked WhatsApp/Signal sessions.

SAFETY / TESTING STATUS
Local mocked browser PKCE, authorization state rejection, same-account identity,
password reset restrictions, cancelled flows and existing state safety tests pass.
Live Microsoft sign-in and Windows installer HAVE NOT been verified on your PC.
Keep backup recovery codes and original data safe until real sign-in works.
