export interface Prompt {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  favourite: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}
export interface Library {
  version: 1;
  prompts: Prompt[];
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface ShelfAPI {
  load(): Promise<Result<Library>>;
  save(prompt: Prompt): Promise<Result<Library>>;
  remove(id: string): Promise<Result<Library>>;
  copy(id: string, values: Record<string, string>): Promise<Result<Library>>;
  exportLibrary(): Promise<Result<boolean>>;
  importLibrary(): Promise<Result<Library | null>>;
}
export function validateLibrary(input: unknown): Library {
  if (!input || typeof input !== "object")
    throw new Error("Expected a library object.");
  const x = input as Library;
  if (x.version !== 1 || !Array.isArray(x.prompts))
    throw new Error("Expected version 1 and a prompts array.");
  if (x.prompts.length > 10000)
    throw new Error("Library exceeds 10,000 prompts.");
  const ids = new Set<string>();
  const date = (v: unknown) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(v) &&
    Number.isFinite(Date.parse(v));
  const prompts = x.prompts.map((p, i) => {
    if (!p || typeof p !== "object")
      throw new Error(`Invalid prompt ${i + 1}.`);
    for (const key of ["id", "title", "body", "category"] as const)
      if (
        typeof p[key] !== "string" ||
        !p[key].trim() ||
        p[key].length > (key === "body" ? 100000 : 500)
      )
        throw new Error(`Prompt ${i + 1}: invalid ${key}.`);
    if (ids.has(p.id)) throw new Error(`Duplicate ID: ${p.id}`);
    ids.add(p.id);
    if (
      !Array.isArray(p.tags) ||
      p.tags.length > 100 ||
      !p.tags.every((t) => typeof t === "string" && t.length <= 100) ||
      typeof p.favourite !== "boolean" ||
      !date(p.createdAt) ||
      !date(p.updatedAt) ||
      (p.lastUsedAt !== null && !date(p.lastUsedAt))
    )
      throw new Error(
        `Prompt ${i + 1}: invalid tags, favourite or timestamps.`,
      );
    return {
      id: p.id,
      title: p.title,
      body: p.body,
      category: p.category,
      tags: [...p.tags],
      favourite: p.favourite,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lastUsedAt: p.lastUsedAt,
    };
  });
  const library: Library = { version: 1, prompts };
  if (
    new TextEncoder().encode(JSON.stringify(library, null, 2)).byteLength >
    20_000_000
  )
    throw new Error(
      "Library exceeds 20 MB. Export a backup and remove unused prompts before adding more.",
    );
  return library;
}
export function placeholders(body: string): string[] {
  return [
    ...new Set(
      [...body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
        .map((m) => m[1].trim())
        .filter(Boolean),
    ),
  ];
}
export function fill(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key.trim())
      ? values[key.trim()]
      : match,
  );
}
export function complete(
  body: string,
  values: Record<string, string>,
): boolean {
  return placeholders(body).every(
    (k) => typeof values[k] === "string" && values[k].trim().length > 0,
  );
}
export function merge(current: Library, incoming: Library): Library {
  const map = new Map(current.prompts.map((p) => [p.id, p]));
  for (const p of incoming.prompts) map.set(p.id, p);
  return validateLibrary({ version: 1, prompts: [...map.values()] });
}
export function findPrompts(
  prompts: Prompt[],
  query: string,
  category: string,
  favourites: boolean,
  sort: string,
): Prompt[] {
  const q = query.trim().toLocaleLowerCase();
  return prompts
    .filter(
      (p) =>
        (!category || p.category === category) &&
        (!favourites || p.favourite) &&
        (!q ||
          [p.title, p.body, ...p.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(q)),
    )
    .sort(
      (a, b) =>
        (sort === "used"
          ? Date.parse(b.lastUsedAt || "1970-01-01") -
            Date.parse(a.lastUsedAt || "1970-01-01")
          : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) ||
        a.title.localeCompare(b.title),
    );
}
export function examples(): Library {
  const now = new Date().toISOString();
  const rows = [
    [
      "A clearer first draft",
      "Writing",
      "Rewrite the following text for {{audience}}. Keep the meaning, use plain language, and make it concise.\n\n{{text}}",
      ["editing", "clarity"],
    ],
    [
      "Learn something deeply",
      "Learning",
      "Teach me {{topic}} at a {{level}} level. Explain the core idea, give a concrete example, then ask three questions to test my understanding of {{topic}}.",
      ["study"],
    ],
    [
      "Turn notes into next steps",
      "Work",
      "Turn these meeting notes into a summary, decisions, and action items with owners and deadlines. Flag missing details.\n\n{{notes}}",
      ["meetings"],
    ],
    [
      "A thoughtful code review",
      "Coding",
      "Review this {{language}} code for correctness, edge cases and readability. Explain each issue and suggest a minimal fix.\n\n{{code}}",
      ["review"],
    ],
    [
      "Make room for the week",
      "Everyday life",
      "Help me plan a balanced week. First ask about my commitments, priorities, energy levels, and time for rest. Then propose a realistic plan with space for unexpected tasks.",
      ["planning"],
    ],
    [
      "Find an unexpected angle",
      "Creativity",
      "Generate ten unexpected ideas for {{project}} inspired by {{inspiration}}. For each, give a title, a one-sentence concept and a practical first step.",
      ["ideas"],
    ],
  ] as const;
  return {
    version: 1,
    prompts: rows.map((r, i) => ({
      id: `starter-${i + 1}`,
      title: r[0],
      category: r[1],
      body: r[2],
      tags: [...r[3]],
      favourite: i === 0,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
    })),
  };
}
