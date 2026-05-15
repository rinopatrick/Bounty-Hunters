// System tray icon + context menu (issue 859).
import { app, Menu, Tray, shell, nativeImage } from "electron";

let tray: Tray | null = null;

export function registerTray(): void {
  if (tray || process.platform !== "darwin") return;
  const icon = nativeImage.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
  tray = new Tray(icon);
  tray.setToolTip("T3 Code");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show", click: () => app.emit("activate") },
    { label: "Hide",  click: () => (app.mainWindow as any)?.hide() },
    { type: "separator" },
    { label: "DevTools", click: () => (app.mainWindow as any)?.webContents?.openDevTools() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]));
}
