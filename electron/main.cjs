const { app, BrowserWindow, dialog, globalShortcut, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const STORE_FILE = "todo-notes-store.json";
const CANDIDATE_URLS = ["http://127.0.0.1:5173", "http://127.0.0.1:4173"];
const GLOBAL_SHORTCUT = "CommandOrControl+Alt+N";

let mainWindow = null;

app.disableHardwareAcceleration();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function getStorePath() {
  return path.join(app.getPath("userData"), STORE_FILE);
}

async function ensureStore(payload) {
  const storePath = getStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(payload, null, 2), "utf-8");
}

async function loadStore() {
  try {
    const raw = await fs.readFile(getStorePath(), "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function attachDebugLogging(win) {
  win.webContents.on("did-fail-load", (_, errorCode, errorDescription, validatedURL) => {
    console.error("[did-fail-load]", errorCode, errorDescription, validatedURL);
  });

  win.webContents.on("render-process-gone", (_, details) => {
    console.error("[render-process-gone]", JSON.stringify(details));
  });

  win.webContents.on("console-message", (_, level, message, line, sourceId) => {
    console.log("[renderer-console]", level, message, sourceId, line);
  });

  win.webContents.on("preload-error", (_, pathValue, error) => {
    console.error("[preload-error]", pathValue, error);
  });
}

async function resolveRendererTarget() {
  for (const url of CANDIDATE_URLS) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return { kind: "url", value: url };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return {
    kind: "file",
    value: path.join(__dirname, "..", "dist", "index.html")
  };
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

async function handleGlobalShortcut() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createWindow();
    return;
  }

  showMainWindow();
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();
  globalShortcut.register(GLOBAL_SHORTCUT, () => {
    handleGlobalShortcut().catch((error) => {
      console.error("[global-shortcut-error]", error);
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "Local Todo Notes",
    backgroundColor: "#f6f0e8",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  attachDebugLogging(mainWindow);

  const target = await resolveRendererTarget();

  if (target.kind === "url") {
    await mainWindow.loadURL(target.value);
  } else {
    await mainWindow.loadFile(target.value);
  }

  return mainWindow;
}

ipcMain.handle("store:load", async () => {
  return loadStore();
});

ipcMain.handle("store:save", async (_, payload) => {
  await ensureStore(payload);
  return { ok: true };
});

ipcMain.handle("backup:export", async (_, payload) => {
  const result = await dialog.showSaveDialog({
    title: "导出备份",
    defaultPath: `todo-notes-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle("backup:import", async () => {
  const result = await dialog.showOpenDialog({
    title: "导入备份",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const raw = await fs.readFile(result.filePaths[0], "utf-8");
  const payload = JSON.parse(raw);
  await ensureStore(payload);
  return { ok: true, payload };
});

app.on("second-instance", () => {
  showMainWindow();
});

app.whenReady().then(async () => {
  await createWindow();
  registerGlobalShortcuts();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
      return;
    }

    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
