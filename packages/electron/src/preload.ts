import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  quit: () => ipcRenderer.send("quit"),
});
