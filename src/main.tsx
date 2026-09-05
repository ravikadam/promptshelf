import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  complete,
  fill,
  findPrompts,
  Library,
  placeholders,
  Prompt,
  Result,
  ShelfAPI,
} from "./model";
import "./style.css";
declare global {
  interface Window {
    shelf: ShelfAPI;
  }
}
function App() {
  const [lib, setLib] = useState<Library>({ version: 1, prompts: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Prompt | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [favourites, setFavourites] = useState(false);
  const [sort, setSort] = useState("updated");
  const search = useRef<HTMLInputElement>(null);
  const original = lib.prompts.find((p) => p.id === selected);
  const dirty =
    editing && !!draft && JSON.stringify(draft) !== JSON.stringify(original);
  const active = editing ? draft : original;
  const categories = [...new Set(lib.prompts.map((p) => p.category))].sort();
  const visible = findPrompts(lib.prompts, query, category, favourites, sort);
  useEffect(() => {
    window.shelf
      .load()
      .then((r) => {
        if (r.ok) {
          setLib(r.value);
          setSelected(r.value.prompts[0]?.id || null);
          setReady(true);
        } else setError(r.error);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  function mayLeave() {
    return !dirty || window.confirm("Discard your unsaved edits?");
  }
  function choose(p: Prompt) {
    if (!mayLeave()) return;
    setSelected(p.id);
    setEditing(false);
    setDraft(null);
    setValues({});
  }
  function newPrompt() {
    if (!ready || busy || !mayLeave()) return;
    const now = new Date().toISOString();
    setSelected(null);
    setDraft({
      id: crypto.randomUUID(),
      title: "",
      body: "",
      category: category || "Writing",
      tags: [],
      favourite: false,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
    });
    setEditing(true);
    setValues({});
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        ["n", "f"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "n") newPrompt();
        else search.current?.focus();
      }
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (
        dirty &&
        !window.confirm("Discard your unsaved edits and close PromptShelf?")
      ) {
        e.preventDefault();
        e.returnValue = false as unknown as string;
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("beforeunload", unload);
    };
  });
  async function run<T>(
    fn: () => Promise<Result<T>>,
    success: (value: T) => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (r.ok) success(r.value);
      else setError(r.error);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function save() {
    if (!draft) return;
    const p = {
      ...draft,
      title: draft.title.trim(),
      category: draft.category.trim(),
      tags: [...new Set(draft.tags.map((t) => t.trim()).filter(Boolean))],
    };
    void run(
      () => window.shelf.save(p),
      (l) => {
        setLib(l);
        setSelected(p.id);
        setEditing(false);
        setDraft(null);
        setValues({});
        setNotice("Prompt saved");
      },
    );
  }
  function duplicate() {
    if (!original) return;
    const p = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title} (copy)`,
      lastUsedAt: null,
    };
    void run(
      () => window.shelf.save(p),
      (l) => {
        setLib(l);
        setSelected(p.id);
        setValues({});
        setNotice("Prompt duplicated");
      },
    );
  }
  function update(p: Partial<Prompt>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">P</span>PromptShelf
        </div>
        <p className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</p>
        <button
          className="primary new"
          onClick={newPrompt}
          disabled={!ready || busy}
        >
          ＋ New prompt <kbd>⌘ / Ctrl N</kbd>
        </button>
        <div className="nav-label">LIBRARY</div>
        <button
          className={!category && !favourites ? "nav selected" : "nav"}
          onClick={() => {
            setCategory("");
            setFavourites(false);
          }}
        >
          ▦ <span>All prompts</span>
          <small>{lib.prompts.length}</small>
        </button>
        <button
          className={favourites ? "nav selected" : "nav"}
          onClick={() => {
            setCategory("");
            setFavourites(true);
          }}
        >
          ☆ <span>Favourites</span>
          <small>{lib.prompts.filter((p) => p.favourite).length}</small>
        </button>
        <div className="nav-label">CATEGORIES</div>
        <div className="category-list">
          {categories.map((c) => (
            <button
              className={category === c ? "nav selected" : "nav"}
              key={c}
              onClick={() => {
                setCategory(c);
                setFavourites(false);
              }}
            >
              <span className="dot" />
              <span>{c}</span>
              <small>
                {lib.prompts.filter((p) => p.category === c).length}
              </small>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button
            disabled={!ready || busy}
            onClick={() => {
              if (mayLeave())
                void run(
                  () => window.shelf.importLibrary(),
                  (l) => {
                    if (l) {
                      setLib(l);
                      setEditing(false);
                      setDraft(null);
                      setSelected(l.prompts[0]?.id || null);
                      setValues({});
                      setNotice("Library imported");
                    }
                  },
                );
            }}
          >
            ↓ Import library
          </button>
          <button
            disabled={!ready || busy}
            onClick={() =>
              void run(
                () => window.shelf.exportLibrary(),
                (done) => {
                  if (done) setNotice("Library exported");
                },
              )
            }
          >
            ↑ Export library
          </button>
          <div className="local">
            <i /> Stored on this device
          </div>
        </div>
      </aside>
      <main className="list-pane">
        <header>
          <div className="eyebrow">YOUR PROMPT COLLECTION</div>
          <h1>
            {category || (favourites ? "Favourites" : "All prompts")}
            <span>{visible.length}</span>
          </h1>
          <div className="search-wrap">
            <span>⌕</span>
            <input
              ref={search}
              aria-label="Search prompts"
              placeholder="Search prompts, tags, or text…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sort">
            <span>Find the right words, faster.</span>
            <select
              aria-label="Sort prompts"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="updated">Recently updated</option>
              <option value="used">Recently used</option>
            </select>
          </div>
        </header>
        <div className="prompt-list">
          {visible.map((p) => (
            <button
              key={p.id}
              className={`card ${selected === p.id ? "active" : ""}`}
              onClick={() => choose(p)}
              disabled={busy}
            >
              <div className="card-category">
                {p.category}
                <span>{p.favourite ? "★" : "↗"}</span>
              </div>
              <h2>{p.title}</h2>
              <p>{p.body}</p>
              <div className="tags">
                {p.tags.slice(0, 3).map((t, i) => (
                  <span key={i}>#{t}</span>
                ))}
                <small>
                  {placeholders(p.body).length
                    ? `${placeholders(p.body).length} fields`
                    : "Ready to copy"}
                </small>
              </div>
            </button>
          ))}
          {!visible.length && (
            <div className="empty">
              <span>▤</span>
              <h2>
                {lib.prompts.length
                  ? "No matching prompts"
                  : "Your shelf is ready"}
              </h2>
              <p>
                {lib.prompts.length
                  ? "Try another search or category."
                  : "Create your first reusable prompt."}
              </p>
            </div>
          )}
        </div>
        <footer>{lib.prompts.length} prompts · Yours to keep.</footer>
      </main>
      <section className="detail">
        <div aria-live="polite" className="messages">
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              ✓ {notice}
            </div>
          )}
        </div>
        {active ? (
          <>
            <div className="detail-top">
              <span className="eyebrow">
                {editing ? "EDIT PROMPT" : "PROMPT WORKSPACE"}
              </span>
              <div>
                {editing ? (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (mayLeave()) {
                        setEditing(false);
                        setDraft(null);
                      }
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    <button
                      aria-label={
                        original?.favourite
                          ? "Remove favourite"
                          : "Add favourite"
                      }
                      disabled={busy}
                      onClick={() =>
                        original &&
                        void run(
                          () =>
                            window.shelf.save({
                              ...original,
                              favourite: !original.favourite,
                            }),
                          setLib,
                        )
                      }
                    >
                      {original?.favourite ? "★" : "☆"}
                    </button>
                    <button disabled={busy} onClick={duplicate}>
                      Duplicate
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setDraft(structuredClone(original!));
                        setEditing(true);
                      }}
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="detail-scroll">
              {editing && draft ? (
                <div className="editor">
                  <h1>
                    {original ? "Make it your own." : "A new idea starts here."}
                  </h1>
                  <label>
                    Title
                    <input
                      autoFocus
                      maxLength={500}
                      value={draft.title}
                      onChange={(e) => update({ title: e.target.value })}
                    />
                  </label>
                  <div className="edit-row">
                    <label>
                      Category
                      <input
                        list="categories"
                        maxLength={500}
                        value={draft.category}
                        onChange={(e) => update({ category: e.target.value })}
                      />
                      <datalist id="categories">
                        {categories.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.favourite}
                        onChange={(e) =>
                          update({ favourite: e.target.checked })
                        }
                      />{" "}
                      Favourite
                    </label>
                  </div>
                  <label>
                    Tags <small>comma-separated</small>
                    <input
                      value={draft.tags.join(",")}
                      onChange={(e) =>
                        update({ tags: e.target.value.split(",") })
                      }
                    />
                  </label>
                  <label>
                    Prompt template
                    <textarea
                      rows={12}
                      maxLength={100000}
                      value={draft.body}
                      onChange={(e) => update({ body: e.target.value })}
                    />
                  </label>
                  <p className="hint">
                    Use {"{{placeholder}}"} for a reusable field. Repeated names
                    share one input.
                  </p>
                  <div className="section-label">TEMPLATE PREVIEW</div>
                  <pre className="preview">
                    {draft.body || "Your template will appear here."}
                  </pre>
                </div>
              ) : (
                <>
                  <div className="category-pill">{active.category}</div>
                  <h1 className="prompt-title">{active.title}</h1>
                  <div className="tags detail-tags">
                    {active.tags.filter(Boolean).map((t, i) => (
                      <span key={i}>#{t}</span>
                    ))}
                  </div>
                  <div className="section-label">
                    01 <span>THE TEMPLATE</span>
                  </div>
                  <pre className="template">{active.body}</pre>
                  <div className="section-label">
                    02 <span>MAKE IT YOURS</span>
                    <small>
                      {placeholders(active.body).length
                        ? "All fields required"
                        : "No fields needed"}
                    </small>
                  </div>
                  {placeholders(active.body).length ? (
                    <div className="fields">
                      {placeholders(active.body).map((k) => (
                        <label key={k}>
                          {k}
                          <textarea
                            rows={2}
                            required
                            placeholder={`Enter ${k}…`}
                            maxLength={100000}
                            value={
                              Object.prototype.hasOwnProperty.call(values, k)
                                ? values[k]
                                : ""
                            }
                            onChange={(e) =>
                              setValues((v) => ({ ...v, [k]: e.target.value }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="hint">
                      This prompt is ready to use. Copy it whenever inspiration
                      strikes.
                    </p>
                  )}
                  <div className="section-label">
                    03 <span>LIVE PREVIEW</span>
                  </div>
                  <pre className="preview">{fill(active.body, values)}</pre>
                  <p className="hint">
                    Field values stay in this session. Your template is always
                    preserved.
                  </p>
                  <p className="metadata">
                    Updated {new Date(active.updatedAt).toLocaleDateString()}
                    {active.lastUsedAt
                      ? ` · Last used ${new Date(active.lastUsedAt).toLocaleString()}`
                      : " · Not used yet"}
                  </p>
                </>
              )}
            </div>
            <div className="action-bar">
              {editing ? (
                <>
                  <span className="hint">
                    {dirty ? "Unsaved changes" : "No changes yet"}
                  </span>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !draft?.title.trim() ||
                      !draft.body.trim() ||
                      !draft.category.trim()
                    }
                    onClick={save}
                  >
                    Save prompt
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="delete"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => window.shelf.remove(active.id),
                        (l) => {
                          setLib(l);
                          if (!l.prompts.some((p) => p.id === active.id)) {
                            setSelected(null);
                            setValues({});
                            setNotice("Prompt deleted");
                          }
                        },
                      )
                    }
                  >
                    Delete
                  </button>
                  <button
                    className="primary"
                    disabled={busy || !complete(active.body, values)}
                    onClick={() =>
                      void run(
                        () => window.shelf.copy(active.id, values),
                        (l) => {
                          setLib(l);
                          setNotice("Copied to clipboard");
                        },
                      )
                    }
                  >
                    Copy prompt <span>↗</span>
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="empty workspace-empty">
            <span>✧</span>
            <h1>A good prompt goes a long way.</h1>
            <p>Select a prompt to fill it in, or create something new.</p>
          </div>
        )}
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
