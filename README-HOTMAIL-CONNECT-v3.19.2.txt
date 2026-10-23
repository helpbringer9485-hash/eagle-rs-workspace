EAGLE RS Hotmail Connect v3.19.2 – UI recovery fix
================================================
CAUSE SHOWN IN VIDEO: Client ID is entered but the user is not filling the current
EAGLE RS master passphrase in an earlier off-screen field. Configuring an OAuth
client is protected by the current local passphrase by design, so Save correctly
refuses. Version 3.19.1 made the required field hard to see.

WHAT IS CHANGED
- Local master passphrase field is visible right next to Microsoft sign-in buttons.
- One click on "Save Client ID & connect Hotmail" saves the public client ID
  after local password confirmation, and starts the actual Microsoft device-code
  sign-in if configuration succeeds.
- Missing password or Microsoft network errors are reported in the visible
  Microsoft status area, not hidden inside a closed drawer.
- Connection will only be declared verified after Microsoft confirms identity.
- Current app identity, passphrase verification, and messaging partitions are
  unchanged. An optional cloud settings backup is NOT a messaging history backup.

STEPS AFTER INSTALL
1) Fully quit EAGLE RS (including tray), back up %APPDATA%\eagle-rs-workspace.
2) Install v3.19.2 and unlock using your existing EAGLE RS passphrase.
3) Settings > Security > Microsoft > Application (client) ID.
4) Enter the public Client ID copied from Entra.
5) Enter the SAME EAGLE RS password that unlocks this workspace into the
   "Confirm EAGLE RS master passphrase" field DIRECTLY below the setup panel.
6) Click "Save Client ID & connect Hotmail" once, then follow the official
   Microsoft device-code browser flow. Don't share your code or credentials.

Testing: run npm.cmd install; npm.cmd run check; npm.cmd run dist.
IMPORTANT: Real Hotmail sign-in, Windows installer and notification behavior
cannot be validated in this Linux environment. Do not delete the old app data.
