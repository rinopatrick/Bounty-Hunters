/**
 * Electron application menu bar for T3 Code Desktop.
 *
 * Adds two custom menus on top of the default Electron menu:
 *
 * 1. **Developer** — toggles the dev tools, clears and restarts the terminal,
 *    and restarts the backend process via the IPC bridge.
 * 2. **Git** — triggers the equivalent git commands (stage-all, commit, push,
 *    pull, create-branch) through the same IPC bridge so the renderer never
 *    spawns child processes directly.
 *
 * Keyboard accelerators match VS Code conventions:
 *
 * | Action           | macOS        | Win / Linux |
 * |------------------|-------------|-------------|
 * | Toggle Terminal  | Ctrl J       | Ctrl J      |
 * | Clear Terminal   | Ctrl K       | Ctrl K      |
 * | Restart Backend  | Ctrl R       | Ctrl R      |
 * | DevTools         | Alt Cmd I    | Ctrl Shift I|
 * | Stage All        |              |             |
 * | Commit           | Cmd Enter    |             |
 * | Push             |              |             |
 * | Pull             |              |             |
 * | Create Branch    |              |             |
 *
 * Menu items whose action is unavailable are automatically disabled by
 * `electron-menu.ts` based on IPC connectivity state.
 */

import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { join } from "path";

const { spawn } = require("child_process");

// ---------------------------------------------------------------------------
// IPC channel names — must match the renderer / main process bridge.
// ---------------------------------------------------------------------------

export const IPC_CHANNELS = {
  ToggleTerminal: "dev:toggle-terminal",
  ClearTerminal: "dev:clear-terminal",
  RestartBackend: "backend:restart",
  OpenDevTools: "devtools:open",
  GitStageAll: "git:stage-all",
  GitCommit: "git:commit",
  GitPush: "git:push",
  GitPull: "git:pull",
  GitCreateBranch: "git:create-branch",
} as const;

type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ---------------------------------------------------------------------------
// Backend process manager
// ---------------------------------------------------------------------------

let backendProcess: ReturnType<typeof spawn> | null = null;

/** Start the T3 Code backend subprocess. */
function startBackend(cwd: string): void {
  if (backendProcess) {
    stopBackend();
  }
  backendProcess = spawn(process.execPath, [join(cwd, "apps", "server", "src", "main.ts")], {
    cwd,
    stdio: "inherit",
  });
  backendProcess.on("exit", (code: number | null) => {
    console.log(`[menu] backend exited with code ${code}`);
    backendProcess = null;
  });
}

/** Stop the T3 Code backend subprocess. */
function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
}

// ---------------------------------------------------------------------------
// IPC error-safe helpers
// ---------------------------------------------------------------------------

function sendIpc(window: BrowserWindow, channel: IpcChannel, payload: unknown = null): boolean {
  try {
    window.webContents.send(channel, payload);
    return true;
  } catch (e) {
    console.error(`[menu] Failed to send IPC message on "${channel}":`, e);
    return false;
  }
}

function canSendIpc(window: BrowserWindow): boolean {
  return window && !window.isDestroyed();
}

// ---------------------------------------------------------------------------
// Label builders
// ---------------------------------------------------------------------------

function developerLabel(isMac: boolean): Electron.MenuItemConstructorOptions {
  return {
    label: "Developer",
    submenu: [
      {
        label: "Toggle Terminal",
        accelerator: "CmdOrCtrl+J",
        click: (_, win) =>
          canSendIpc(win) && sendIpc(win, IPC_CHANNELS.ToggleTerminal),
      },
      {
        label: "Clear Terminal",
        accelerator: "CmdOrCtrl+K",
        click: (_, win) =>
          canSendIpc(win) && sendIpc(win, IPC_CHANNELS.ClearTerminal),
      },
      {
        label: "Restart Backend",
        accelerator: "CmdOrCtrl+R",
        click: (_, win) =>
          canSendIpc(win) && sendIpc(win, IPC_CHANNELS.RestartBackend),
      },
      { type: "separator" },
      {
        label: "Open DevTools",
        accelerator: isMac ? "Alt+Cmd+I" : "Ctrl+Shift+I",
        click: (_, win) => {
          if (canSendIpc(win))
            win.webContents.toggleDevTools();
        },
      },
    ],
  };
}

function gitLabel(isMac: boolean): Electron.MenuItemConstructorOptions {
  return {
    label: "Git",
    submenu: [
      {
        label: "Stage All Changes",
        accelerator: "CmdOrCtrl+Alt+S",
        click: (_, win) =>
          canSendIpc(win) && sendIpc(win, IPC_CHANNELS.GitStageAll),
      },
      {
        label: "Commit",
        accelerator: isMac ? "Cmd+Enter" : "Ctrl+Enter",
        click: (_, win) =>
          canSendIpc(win) && sendIpc(win, IPC_CHANNELS.GitCommit),
      },
      { type: "separator" },
      {
        label: "Push",
        accelerator: "CmdOrCtrl+Alt+P",
        click: (_, win) =>
          canSendIpc(win) && sendIpc(win, IPC_CHANNELS.GitPush),
      },
      {
        label: "Pull",
        accelerator: "CmdOrCtrl+Alt+L",
        click: (_, win) =>
          canSendIpc(win) && sendIpc(win, IPC_CHANNELS.GitPull),
      },
      { type: "separator" },
      {
        label: "Create Branch…",
        accelerator: "CmdOrCtrl+Alt+B",
        click: async (_, win) => {
          if (!canSendIpc(win)) return;
          const project = win.webContents.getURL()
            ? win.webContents.getURL()
            : "";
          const result = await dialog.showMessageBox(win, {
            type: "prompt",
            title: "Create New Branch",
            message: "Enter new branch name:",
            buttons: ["Create", "Cancel"],
            defaultId: 1,
            validateInput: (name: string) =>
              name.trim().length > 0 || "Branch name cannot be empty",
          });
          if (result.response === 0 && result.checkboxChecked !== true) {
            sendIpc(win, IPC_CHANNELS.GitCreateBranch, result.text.trim());
          }
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the full menu template for the current process.
 *
 * @param cwd  The project root (used by backend-start logic).
 */
export function buildMenu(cwd?: string): Menu {
  const isMac = process.platform === "darwin";

  const template: (Electron.MenuItemConstructionOptions | Electron.MenuItem)[] = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: isMac
        ? [
            { role: "close" },
          ]
        : [
            { role: "quit" },
          ],
    },
    developerLabel(isMac),
    gitLabel(isMac),
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Register all IPC listeners that respond to menu actions from the renderer.
 */
export function registerIpcListeners(win: BrowserWindow): void {
  // These handlers are kept intentionally thin — business logic belongs in the
  // renderer process / server RPC layer; this module only provides the bridge.
  ipcMain.on(IPC_CHANNELS.RestartBackend, () => {
    stopBackend();
    if (win.webContents) {
      try {
        const cwd = win.webContents.getURL().replace("file://", "");
        startBackend(cwd);
      } catch {
        // If cwd cannot be determined, skip
      }
    }
  });

  // The remaining channels are forwarded as-is; the renderer is responsible
  // for executing the actual backend action via its own RPC layer.
  [
    IPC_CHANNELS.ToggleTerminal,
    IPC_CHANNELS.ClearTerminal,
    IPC_CHANNELS.GitStageAll,
    IPC_CHANNELS.GitCommit,
    IPC_CHANNELS.GitPush,
    IPC_CHANNELS.GitPull,
  ].forEach((channel) => {
    ipcMain.on(channel, (_, payload) => {
      console.log(`[menu] Received IPC "${channel}":`, payload);
    });
  });
}
