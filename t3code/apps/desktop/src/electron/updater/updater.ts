// Auto-updater with progress + defer + skip (issue 842).
import { autoUpdater, ipcMain } from "electron";
import Store from "electron-store";
const store = new Store();

interface UpdateState { downloading: boolean; percent: number; skipped: string | null; deferUntil: number | null; }
const state: UpdateState = {downloading:false, percent:0, skipped:null, deferUntil:null};

function shouldSkip(ver: string): boolean {
  if (store.get("skippedVersion") as string === ver) return true;
  if (state.deferUntil && Date.now() < state.deferUntil) return true;
  return false;
}

function checkAndNotify() {
  autoUpdater.checkForUpdates();
  autoUpdater.on("download-progress", (e: any) => { state.percent = e.percent; });
  autoUpdater.on("update-available", (e: any) => {
    if (shouldSkip(e.version)) { autoUpdater.quitAndInstall(); return; }
    state.downloading = true;
    ipcMain.emit("update-progress", null, {percent:0, version:e.version});
  });
  autoUpdater.on("update-downloaded", () => { state.downloading=false; state.percent=100; });
}

ipcMain.on("defer-update",  () => { state.deferUntil = Date.now()+24*3600*1000; });
ipcMain.on("skip-version",  (_:any,v:string) => { store.set("skippedVersion", v); });
ipcMain.on("get-update-progress",  (e:any) => { e.returnValue = state.percent; });
