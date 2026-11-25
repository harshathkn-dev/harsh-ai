const { app, BrowserWindow, desktopCapturer, session, shell } = require("electron");

const APP_URL =
  process.env.HARSH_AI_URL ||
  "https://harsh-ai-git-main-harsh-s-dev.vercel.app";

let mainWindow;

async function installAudioCaptureHandler() {
  // Windows loopback captures system playback audio. The display source is
  // required by Chromium's display-media API, but the web app only attaches
  // the audio track to its Realtime connection; it never transmits video.
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 0, height: 0 },
          fetchWindowIcons: false,
        });
        const source = sources[0];

        if (!source) {
          callback({});
          return;
        }

        callback({
          video: source,
          audio: "loopback",
        });
      } catch (error) {
        console.error("Could not initialize Windows audio loopback", error);
        callback({});
      }
    },
    { useSystemPicker: false },
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    show: false,
    title: "Harsh AI Desktop",
    backgroundColor: "#07111f",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const allowed = new URL(APP_URL);
    if (target.origin !== allowed.origin) {
      event.preventDefault();
      if (target.protocol === "https:") void shell.openExternal(url);
    }
  });

  void mainWindow.loadURL(APP_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (process.platform !== "win32") {
    console.warn(
      "The first desktop release is designed for Windows system-audio loopback.",
    );
  }

  await installAudioCaptureHandler();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
