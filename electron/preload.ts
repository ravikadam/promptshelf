import { contextBridge, ipcRenderer } from "electron";
import type { ShelfAPI } from "../src/model";
const api: ShelfAPI = {
  load: () => ipcRenderer.invoke("shelf:load"),
  save: (p) => ipcRenderer.invoke("shelf:save", p),
  remove: (id) => ipcRenderer.invoke("shelf:remove", id),
  copy: (id, values) => ipcRenderer.invoke("shelf:copy", id, values),
  exportLibrary: () => ipcRenderer.invoke("shelf:export"),
  importLibrary: () => ipcRenderer.invoke("shelf:import"),
};
contextBridge.exposeInMainWorld("shelf", api);
