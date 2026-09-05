import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { complete, fill, merge, Prompt, validateLibrary } from "../src/model";
import { Store, atomicWrite } from "./store";
let window: BrowserWindow;
// A separate data directory is useful for integration tests; never exposed to the renderer.
if (process.env.PROMPTSHELF_DATA_DIR)
  app.setPath("userData", process.env.PROMPTSHELF_DATA_DIR);
const store = new Store(path.join(app.getPath("userData"), "library.json"));
let queue: Promise<unknown> = Promise.resolve();
function handle(name: string, fn: (...args: any[]) => Promise<unknown>) {
  ipcMain.handle(`shelf:${name}`, (event, ...args) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("Untrusted request.");
    const result = queue.then(async () => {
      try {
        return { ok: true, value: await fn(...args) };
      } catch (e) {
        return {
          ok: false,
          error:
            e instanceof Error
              ? e.message
              : "Operation failed. Please try again.",
        };
      }
    });
    queue = result;
    return result;
  });
}
handle("load", () => store.load());
handle("save", async (input: Prompt) => {
  const p = validateLibrary({ version: 1, prompts: [input] }).prompts[0];
  const lib = await store.load();
  const old = lib.prompts.find((x) => x.id === p.id);
  const now = new Date().toISOString();
  const saved = {
    ...p,
    createdAt: old?.createdAt || now,
    updatedAt: now,
    lastUsedAt: old?.lastUsedAt || null,
  };
  return store.commit({
    version: 1,
    prompts: [...lib.prompts.filter((x) => x.id !== p.id), saved],
  });
});
handle("remove", async (id: string) => {
  const lib = await store.load();
  if (typeof id !== "string" || !lib.prompts.some((p) => p.id === id))
    throw new Error("Prompt not found.");
  const result = await dialog.showMessageBox(window, {
    type: "warning",
    message: "Delete this prompt?",
    detail: "This cannot be undone.",
    buttons: ["Cancel", "Delete"],
    defaultId: 0,
    cancelId: 0,
  });
  return result.response === 1
    ? store.commit({
        version: 1,
        prompts: lib.prompts.filter((p) => p.id !== id),
      })
    : lib;
});
handle("copy", async (id: string, values: Record<string, string>) => {
  const lib = await store.load();
  const p = lib.prompts.find((p) => p.id === id);
  if (!p) throw new Error("Save this prompt before copying.");
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    !Object.values(values).every(
      (v) => typeof v === "string" && v.length <= 100000,
    ) ||
    !complete(p.body, values)
  )
    throw new Error("Fill every required field before copying.");
  const result = await store.commit({
    version: 1,
    prompts: lib.prompts.map((x) =>
      x.id === id ? { ...x, lastUsedAt: new Date().toISOString() } : x,
    ),
  });
  clipboard.writeText(fill(p.body, values));
  return result;
});
handle("export", async () => {
  const lib = await store.load();
  const result = await dialog.showSaveDialog(window, {
    defaultPath: "promptshelf-library.json",
    filters: [{ name: "JSON library", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return false;
  if (path.resolve(result.filePath) === path.resolve(store.file))
    throw new Error("Choose a location outside the active library file.");
  await atomicWrite(result.filePath, lib);
  return true;
});
handle("import", async () => {
  const lib = await store.load();
  const result = await dialog.showOpenDialog(window, {
    properties: ["openFile"],
    filters: [{ name: "JSON library", extensions: ["json"] }],
  });
  if (result.canceled) return null;
  const file = result.filePaths[0];
  if ((await fs.stat(file)).size > 20000000)
    throw new Error("Import exceeds 20 MB.");
  let incoming;
  try {
    incoming = validateLibrary(JSON.parse(await fs.readFile(file, "utf8")));
  } catch (e) {
    throw new Error(
      `Import rejected. ${e instanceof Error ? e.message : "Invalid JSON."} Your library is unchanged.`,
    );
  }
  const count = incoming.prompts.filter((p) =>
    lib.prompts.some((x) => x.id === p.id),
  ).length;
  if (count) {
    const answer = await dialog.showMessageBox(window, {
      type: "warning",
      message: `Overwrite ${count} existing prompt${count === 1 ? "" : "s"}?`,
      detail: "Matching IDs will be replaced. Other prompts will be kept.",
      buttons: ["Cancel import", "Merge and overwrite"],
      defaultId: 0,
      cancelId: 0,
    });
    if (answer.response !== 1) return null;
  }
  return store.commit(merge(lib, incoming));
});
function createWindow() {
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: "#f7f8fa",
    title: "PromptShelf",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
  if (process.argv.includes("--dev"))
    void window.loadURL("http://127.0.0.1:5173");
  else void window.loadFile(path.join(__dirname, "../../dist/index.html"));
}
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
else
  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (window && !window.isDestroyed()) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
