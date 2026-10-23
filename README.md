# EAGLE RS Workspace

A Windows workspace for WhatsApp web sessions, named Signal account entries, manual reply reminders, and optional Gemini screenshot translation and reply drafting.

**Status: experimental.** Native Signal docking is implemented but has not been verified with real Signal accounts. The current binaries are unsigned and may be blocked by Windows Smart App Control. No free-signing application has been approved or submitted. Do not disable Windows protection to run a release.

## Build from source

Use Windows x64 with Node.js 24 and the .NET Framework C# compiler. Run:

```powershell
npm ci
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /reference:System.Web.Extensions.dll /out:SignalDock.exe SignalDock.cs
npm run check
npm run dist
```

The GitHub Actions workflow builds an unsigned Windows installer and uploads it as a build artifact. It does not publish a release or submit anything to a signing provider.

## Signal dock

Open an already-linked Signal Desktop account, select its name in this workspace, refresh the available windows, choose its window, and connect it. Assignments last for the current app session. Test only one account first. Release returns the selected window to the desktop. Real Signal resize, focus, account switching and lock behavior are unverified. This application is not affiliated with Signal, WhatsApp, Google or Microsoft.

## Privacy and security

See [Privacy](PRIVACY.md) and [Security](SECURITY.md). Never commit app profiles, chat databases, screenshots of private chats, passwords, recovery codes, private keys, or signing credentials.

## License

Project source and project-owned artwork are offered under MIT, based on the owner's confirmation of publication rights. Third-party components keep their own licenses; see [Third-party notices](THIRD-PARTY-NOTICES.md). The license does not grant rights to third-party trademarks or accounts.

## Code signing policy

See [Code signing policy](CODE-SIGNING.md). Signing is not configured. SignPath Foundation has not endorsed or approved this project.
