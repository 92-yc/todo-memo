const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("todoNotesApi", {
  loadStore: () => ipcRenderer.invoke("store:load"),
  saveStore: (payload) => ipcRenderer.invoke("store:save", payload),
  exportBackup: (payload) => ipcRenderer.invoke("backup:export", payload),
  importBackup: () => ipcRenderer.invoke("backup:import")
});
