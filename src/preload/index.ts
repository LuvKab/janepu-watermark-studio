import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { JanepuBridge, SaveExportRequest } from "../shared/types";

const bridge: JanepuBridge = {
  selectImages: () => ipcRenderer.invoke("images:select"),
  registerDroppedFiles: (paths) => ipcRenderer.invoke("images:register", paths),
  pathForFile: (file) => webUtils?.getPathForFile
    ? webUtils.getPathForFile(file)
    : (file as File & { path?: string }).path ?? "",
  readImage: (id) => ipcRenderer.invoke("images:read", id),
  selectWatermark: () => ipcRenderer.invoke("watermark:select"),
  chooseOutputDirectory: () => ipcRenderer.invoke("exports:choose-directory"),
  saveExport: (request: SaveExportRequest) => ipcRenderer.invoke("exports:save", request),
  showItemInFolder: (path) => ipcRenderer.invoke("exports:show", path),
};

contextBridge.exposeInMainWorld("janepu", bridge);
