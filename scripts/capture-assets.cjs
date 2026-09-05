const { _electron: electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "promptshelf-assets-"));
  let app;
  try {
    app = await electron.launch({
      args: [process.cwd()],
      env: { ...process.env, PROMPTSHELF_DATA_DIR: dir },
    });
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1360, height: 900 });
    await page
      .locator(".card")
      .filter({ hasText: "Learn something deeply" })
      .click();
    await page.getByLabel("topic", { exact: true }).fill("how habits form");
    await page.getByLabel("level", { exact: true }).fill("beginner");
    await page.screenshot({ path: "docs/screenshot.png" });
    await page.setViewportSize({ width: 512, height: 512 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}</style><svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="24" y="24" width="464" height="464" rx="105" fill="#2c6955"/><path d="M158 350V126h102c74 0 110 34 110 94 0 58-40 94-111 94h-41v36h-60zm60-92h38c36 0 54-12 54-38s-17-38-54-38h-38v76z" fill="#fff"/><rect x="144" y="376" width="232" height="17" rx="8.5" fill="#b9d1c2"/></svg>`,
    );
    await page.screenshot({ path: "build/icon.png", omitBackground: true });
  } finally {
    await app?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
