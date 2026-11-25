# Harsh AI Desktop (Windows)

This is a Windows desktop shell for the existing Harsh AI web application.

## What it does

- Opens the existing Harsh AI account and session interface in a desktop window.
- Handles the app's audio-capture request using Windows system-audio loopback.
- Does not show the browser's screen-sharing picker.
- Provides the audio stream to the web app. The web app sends only the audio track to its AI connection; it does not attach the captured video track.
- Does not create an always-on-top or hidden overlay. Keep the companion window separate from any screen you intentionally share.

The first release targets Windows 10/11. Electron's loopback capture is documented for Windows. Other operating systems need separate implementation and permission testing.

## Run locally

From this directory:

```powershell
npm install
npm start
```

Optional: point the desktop app at a different Harsh AI deployment:

```powershell
$env:HARSH_AI_URL = "https://your-deployment.example"
npm start
```

## Build a Windows installer

```powershell
npm install
npm run dist:win
```

The NSIS installer is written to `release/`.

## Important

- Sign in through the normal Harsh AI login page.
- Start and stop audio capture yourself in the session.
- Windows system playback audio may include sounds from other applications. Close unrelated audio sources before starting.
- No permanent OpenAI API key is embedded in this desktop package.
- Live AI responses still require a valid server-side OpenAI API configuration and available API quota. ChatGPT subscriptions do not include API credits.
- The web app's free demo mode is separate from live transcription and is not a substitute for a real AI API test.
