const {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

const STORE_FILE = "todo-notes-store.json";
const PREFERENCES_FILE = "app-preferences.json";
const CANDIDATE_URLS = ["http://127.0.0.1:5173", "http://127.0.0.1:4173"];
const GLOBAL_SHORTCUT = "CommandOrControl+Alt+N";
const defaultPreferences = {
  launchAtLogin: false,
  minimizeToTrayOnClose: true
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let preferences = { ...defaultPreferences };

app.disableHardwareAcceleration();
app.setAppUserModelId("com.myobject.localtodonotes");

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function getStorePath() {
  return path.join(app.getPath("userData"), STORE_FILE);
}

function getPreferencesPath() {
  return path.join(app.getPath("userData"), PREFERENCES_FILE);
}

function normalizePreferences(payload) {
  return {
    launchAtLogin: Boolean(payload?.launchAtLogin),
    minimizeToTrayOnClose:
      payload?.minimizeToTrayOnClose === undefined
        ? true
        : Boolean(payload.minimizeToTrayOnClose)
  };
}

async function ensureStore(payload) {
  const storePath = getStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(payload, null, 2), "utf-8");
}

async function savePreferences(nextPreferences) {
  const preferencesPath = getPreferencesPath();
  await fs.mkdir(path.dirname(preferencesPath), { recursive: true });
  await fs.writeFile(preferencesPath, JSON.stringify(nextPreferences, null, 2), "utf-8");
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

async function loadPreferences() {
  try {
    const raw = await fs.readFile(getPreferencesPath(), "utf-8");
    return normalizePreferences(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { ...defaultPreferences };
    }
    throw error;
  }
}

function getTrayIconPath() {
  return path.join(__dirname, "..", "build", "icon.png");
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

function applyLaunchAtLogin() {
  if (!app.isPackaged) {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: preferences.launchAtLogin,
    path: process.execPath
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.setSkipTaskbar(false);
  mainWindow.show();
  mainWindow.focus();
}

function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
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

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示主窗口",
        click: () => {
          showMainWindow();
        }
      },
      {
        label: "开机自启动",
        type: "checkbox",
        checked: preferences.launchAtLogin,
        click: () => {
          void updatePreferences({ launchAtLogin: !preferences.launchAtLogin });
        }
      },
      {
        label: "关闭时隐藏到托盘",
        type: "checkbox",
        checked: preferences.minimizeToTrayOnClose,
        click: () => {
          void updatePreferences({
            minimizeToTrayOnClose: !preferences.minimizeToTrayOnClose
          });
        }
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function createTray() {
  if (tray) {
    updateTrayMenu();
    return;
  }

  const trayIcon = nativeImage.createFromPath(getTrayIconPath()).resize({
    width: 18,
    height: 18
  });

  tray = new Tray(trayIcon);
  tray.setToolTip(`暖笺待办 (${GLOBAL_SHORTCUT})`);
  tray.on("click", () => {
    showMainWindow();
  });
  tray.on("double-click", () => {
    showMainWindow();
  });
  updateTrayMenu();
}

async function updatePreferences(patch) {
  preferences = normalizePreferences({
    ...preferences,
    ...patch
  });

  await savePreferences(preferences);
  applyLaunchAtLogin();
  updateTrayMenu();
  return preferences;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "暖笺待办",
    backgroundColor: "#f6f0e8",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("close", (event) => {
    if (isQuitting || !preferences.minimizeToTrayOnClose) {
      return;
    }

    event.preventDefault();
    hideToTray();
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

ipcMain.handle("preferences:get", async () => {
  return preferences;
});

ipcMain.handle("preferences:update", async (_, patch) => {
  return updatePreferences(patch ?? {});
});

app.on("second-instance", () => {
  showMainWindow();
});

app.whenReady().then(async () => {
  preferences = await loadPreferences();
  applyLaunchAtLogin();
  createTray();
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

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
