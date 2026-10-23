EAGLE RS 3.25.0 - EXPERIMENTAL SIGNAL DOCK

This build contains a first implementation of native Signal docking. It has NOT been verified with your real Signal accounts. The desktop test was blocked by an app-approval timeout. Do not rely on the EAGLE RS lock to protect docked Signal content until its behavior has been checked on your machine.

HOW TO TRY ONE ACCOUNT
1. Quit the previous EAGLE RS using its tray menu. Extract the complete ZIP into a new folder and run EAGLE RS Workspace.exe.
2. Open your already-linked account in official Signal Desktop. You do not need to scan a new QR code or delete any account.
3. In EAGLE RS select its name, for example Bunny 1.
4. Select Refresh windows. Choose the corresponding Signal window and press Connect this window.
5. Check that the displayed chat is the correct account. Test typing, resizing, switching to WhatsApp, and locking/unlocking EAGLE RS before connecting more accounts.
6. Repeat for each linked account. A Signal window can be assigned to only one EAGLE RS account name. Multiple windows may have the same title; open and connect one account at a time to avoid confusion.
7. Use Release window to return the selected chat to the desktop. Quit EAGLE RS normally to release attached windows.

Assignments last for the current EAGLE RS session. Reconnect after restarting. This implementation uses existing linked Signal windows; it does not create independent Signal logins, rename profiles, read chat databases, or move your login files. Original Signal profile separation is still controlled by Signal. Do not relink a phone merely because an EAGLE RS name is not connected.

Designed behavior: switching Signal names shows the assigned window in the center panel; chat size follows the panel; switching platforms, opening supported dialogs, hiding/minimizing or locking requests that docked windows hide; Release and normal quit restore native windows. Window size, DPI, focus, crash recovery, and all security/lock behavior still require real desktop testing. If a Signal window disappears after a crash, reopen official Signal Desktop. The docking code does not delete login or message files.

Known limitations: docking has not been tested with real Signal; assignments are not saved across restarts; Signal screenshot capture remains through upload or paste; native windows can interact differently with scaling, keyboard focus, notifications and system dialogs. This is a trial implementation, not a verified secure multi-account Signal client.

Telegram and Call Desk remain removed from the visible workspace. Official provider notification pop-ups remain disabled. Existing saved Telegram records are preserved.

Verification completed: native C# helper compiles; main/preload/renderer/docking JavaScript syntax passes; encrypted-state/recovery, count lifecycle, 18 assistant test groups and screenshot behavior tests pass; Windows folder packaging succeeds. No claim of real Signal docking success is made.
