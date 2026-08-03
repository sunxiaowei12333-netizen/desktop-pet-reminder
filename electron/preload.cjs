const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petDesktop", {
  isDesktop: true,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  getPetAssets: () => ipcRenderer.invoke("assets:get"),
  savePetAssets: (assets) => ipcRenderer.invoke("assets:save", assets),
  getGenerationStatus: () => ipcRenderer.invoke("generation:status"),
  ensureGenerationService: () => ipcRenderer.invoke("generation:ensure"),
  generatePetAssets: (payload) => ipcRenderer.invoke("generation:generate-pet-assets", payload),
  showReminder: (reminder) => ipcRenderer.send("pet:show", reminder),
  dismissReminder: () => ipcRenderer.send("pet:dismiss"),
  snoozeReminder: (minutes = 15) => ipcRenderer.send("pet:snooze", minutes),
  onReminder: (callback) => {
    const listener = (_event, reminder) => callback(reminder);
    ipcRenderer.on("pet:reminder", listener);
    return () => ipcRenderer.removeListener("pet:reminder", listener);
  },
});
