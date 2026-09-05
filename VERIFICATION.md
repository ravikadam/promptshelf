# Verification

Tested on macOS 26.6.2, Apple Silicon (arm64), with Node.js 22.18.0 and Electron 44.2.0.

- Production TypeScript and Vite build: passed.
- Six core tests: passed. Covers title/body/tag search, category/favourite filters, both sort orders, repeated placeholders, literal replacement text, required-field checks, versioned round trips, ID merge, malformed records, duplicate IDs, size limits, restart persistence, empty-library persistence and corruption preservation.
- Real Electron integration test: passed against the production build and packaged `.app`. Covers create/edit/duplicate/delete, discard confirmation, Cmd+N / Cmd+F, live preview, copying disabled until complete, actual macOS clipboard output, direct copying without placeholders, restart persistence, last-used updates and no saved field values.
- Import/export integration: passed, including file content equality, cancelled overwrite, accepted overwrite, invalid-version rejection and unchanged storage after rejection. Native file-picker and confirmation responses are stubbed for unattended testing; the application IPC and real filesystem operations are exercised.
- Corruption integration: passed after restarting with a malformed library. The original bytes remain intact and recovery guidance is shown.
- UI screenshot inspected: three panes, editor controls, prompt list, fields and copy confirmation render correctly.
- macOS arm64 `.app` and DMG packaging: passed. Ad-hoc signed for local use, not notarized; default Electron application icon.
- Dependency installation audit: zero reported vulnerabilities.

Windows, Linux and Intel macOS builds/runtime behaviour remain unverified. Windows NSIS and Linux AppImage targets are configured. Public signing/notarization and installation through the DMG installer UI were not tested.

To rerun against the packaged macOS application:

```sh
PROMPTSHELF_EXECUTABLE="$PWD/release/mac-arm64/PromptShelf.app/Contents/MacOS/PromptShelf" npx playwright test
```

Tests use temporary data directories and remove them afterward. The integration test writes to the real system clipboard. Screenshots and failure traces go to `test-results/` (git-ignored).
