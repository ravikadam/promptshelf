import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { examples, Library, validateLibrary } from "../src/model";
export async function atomicWrite(file: string, data: Library) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temp, "wx", 0o600);
    try {
      await handle.writeFile(
        JSON.stringify(validateLibrary(data), null, 2),
        "utf8",
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, file);
  } finally {
    await fs.unlink(temp).catch(() => {});
  }
}
export class Store {
  private library: Library | undefined;
  constructor(readonly file: string) {}
  async load() {
    if (this.library) return structuredClone(this.library);
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    let raw: string;
    try {
      raw = await fs.readFile(this.file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      const initial = examples();
      await atomicWrite(this.file, initial);
      this.library = initial;
      return structuredClone(initial);
    }
    try {
      this.library = validateLibrary(JSON.parse(raw));
    } catch {
      throw new Error(
        `Cannot read your library. The original file has been preserved at ${this.file}. Back it up, then repair it or move it aside and restart PromptShelf. No changes were made.`,
      );
    }
    return structuredClone(this.library);
  }
  async commit(data: Library) {
    if (!this.library)
      throw new Error(
        "Storage is unavailable. Resolve the recovery error first.",
      );
    const valid = validateLibrary(data);
    await atomicWrite(this.file, valid);
    this.library = valid;
    return structuredClone(valid);
  }
}
