import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
} from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
test("desktop save → find → fill → copy, restart, import/export and recovery", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "promptshelf-e2e-"));
  let app: ElectronApplication | undefined;
  const launch = () =>
    electron.launch({
      args: process.env.PROMPTSHELF_EXECUTABLE ? [] : [process.cwd()],
      executablePath: process.env.PROMPTSHELF_EXECUTABLE,
      env: { ...process.env, PROMPTSHELF_DATA_DIR: dir },
    });
  try {
    app = await launch();
    let page = await app.firstWindow();
    await expect(page.locator(".card")).toHaveCount(6);
    expect(await page.evaluate(() => typeof (window as any).require)).toBe(
      "undefined",
    );
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+n" : "Control+n",
    );
    await page.getByLabel("Title", { exact: true }).fill("Repeat test");
    await page.getByLabel("Category", { exact: true }).fill("Testing");
    await page.getByLabel("Tags").fill("roundtrip,unique");
    await page
      .getByLabel("Prompt template")
      .fill("Hello {{name}}. Again {{ name }}. {{task}}");
    await page
      .getByRole("button", { name: "Save prompt", exact: true })
      .click();
    await expect(page.locator(".prompt-title")).toHaveText("Repeat test");
    await expect(
      page.getByRole("button", { name: "Copy prompt" }),
    ).toBeDisabled();
    await expect(page.locator(".fields textarea")).toHaveCount(2);
    await page.getByLabel("name", { exact: true }).fill("Ada");
    await page.getByLabel("task", { exact: true }).fill("Write $& literally");
    await expect(page.locator(".preview")).toHaveText(
      "Hello Ada. Again Ada. Write $& literally",
    );
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await expect(page.getByRole("status")).toHaveText("✓ Copied to clipboard");
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(
      "Hello Ada. Again Ada. Write $& literally",
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Unsaved");
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Unsaved",
    );
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+f" : "Control+f",
    );
    await expect(page.getByLabel("Search prompts")).toBeFocused();
    await page.getByLabel("Search prompts").fill("unique");
    await expect(page.locator(".card")).toHaveCount(1);
    await page.getByLabel("Search prompts").fill("");
    await page.getByRole("button", { name: /Testing 1/ }).click();
    await expect(page.locator(".card")).toHaveCount(1);
    await page.getByRole("button", { name: /All prompts 7/ }).click();
    await page.screenshot({ path: "test-results/promptshelf.png" });
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.locator(".card")).toHaveCount(7);
    await page.getByRole("button", { name: /Testing.*Repeat test/ }).click();
    await expect(page.getByLabel("name", { exact: true })).toHaveValue("");
    await expect(page.locator(".template")).toContainText("{{name}}");
    const persisted = JSON.parse(
      await fs.readFile(path.join(dir, "library.json"), "utf8"),
    );
    expect(
      persisted.prompts.find((p: any) => p.title === "Repeat test").lastUsedAt,
    ).toBeTruthy();
    expect(JSON.stringify(persisted)).not.toContain("Ada");
    const exported = path.join(dir, "export.json");
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, exported);
    await page.getByRole("button", { name: "Export library" }).click();
    await expect(page.getByRole("status")).toHaveText("✓ Library exported");
    expect(JSON.parse(await fs.readFile(exported, "utf8"))).toEqual(persisted);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
      dialog.showMessageBox = async () => ({
        response: 0,
        checkboxChecked: false,
      });
    }, exported);
    await page.getByRole("button", { name: "Import library" }).click();
    await expect(
      page.getByRole("button", { name: "Import library" }),
    ).toBeEnabled();
    expect(
      JSON.parse(await fs.readFile(path.join(dir, "library.json"), "utf8")),
    ).toEqual(persisted);
    const imported = structuredClone(persisted);
    imported.prompts[0].title = "Imported change";
    await fs.writeFile(exported, JSON.stringify(imported));
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    });
    await page.getByRole("button", { name: "Import library" }).click();
    await expect(page.getByRole("status")).toHaveText("✓ Library imported");
    await expect(page.locator(".card")).toHaveCount(7);
    expect(
      JSON.parse(await fs.readFile(path.join(dir, "library.json"), "utf8")),
    ).toEqual(imported);
    await fs.writeFile(exported, '{"version":9,"prompts":[]}');
    await page.getByRole("button", { name: "Import library" }).click();
    await expect(page.getByRole("alert")).toContainText("Import rejected");
    expect(
      JSON.parse(await fs.readFile(path.join(dir, "library.json"), "utf8")),
    ).toEqual(imported);
    await page.locator(".card").filter({ hasText: "Imported change" }).click();
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.locator(".card")).toHaveCount(8);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.locator(".card")).toHaveCount(7);
    await page
      .locator(".card")
      .filter({ hasText: "Make room for the week" })
      .click();
    await expect(
      page.getByRole("button", { name: "Copy prompt" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await expect(page.getByRole("status")).toHaveText("✓ Copied to clipboard");
    expect(
      await app.evaluate(({ clipboard }) => clipboard.readText()),
    ).toContain("Help me plan a balanced week.");
    await app.close();
    app = undefined;
    await fs.writeFile(path.join(dir, "library.json"), "{corrupt");
    app = await launch();
    page = await app.firstWindow();
    await expect(page.getByRole("alert")).toContainText("preserved");
    expect(await fs.readFile(path.join(dir, "library.json"), "utf8")).toBe(
      "{corrupt",
    );
    await expect(
      page.getByRole("button", { name: /New prompt/ }),
    ).toBeDisabled();
  } finally {
    await app?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
