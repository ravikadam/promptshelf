# Verification

## Local checks

Tested on macOS 26.6.2, Apple Silicon (arm64), with Node.js 22.18.0 and Electron 44.2.0.

- Production TypeScript and Vite build passed.
- Six core tests passed: title/body/tag search, category/favourite filters, both sort orders, repeated placeholders, literal replacement text, required fields, versioned round trips, ID merge, invalid records, duplicate IDs, size limits, restart persistence, empty-library persistence and corruption preservation.
- Real Electron integration passed against the production build and packaged `.app`: create/edit/duplicate/delete, discard confirmation, Cmd+N / Cmd+F, live preview, required-field copy gating, actual clipboard output, direct copying without fields, restart persistence, last-used updates and no saved field values.
- Import/export integration passed: file-content equality, cancelled overwrite, accepted overwrite, invalid-version rejection and unchanged storage after rejection. File-picker and confirmation responses are stubbed; application IPC and real filesystem operations are exercised.
- Restarting with corrupt storage preserved the original bytes and displayed recovery guidance.
- The three-pane UI and a clean starter-content screenshot were visually inspected.
- macOS arm64 `.app` and DMG packaging passed. Public builds include the PromptShelf icon and use ad-hoc signing, without notarization.
- Dependency installation audit reported zero vulnerabilities at verification time.

## Release automation

[GitHub Actions](https://github.com/ravikadam/promptshelf/actions/workflows/build.yml) runs formatting checks, core tests and production builds on Windows, Linux, macOS Apple Silicon and Intel macOS. Both macOS jobs also run the real Electron desktop acceptance test. Each platform produces its native installer, and the release job publishes only after all four platform jobs succeed.

See the [v1.0.1 release run](https://github.com/ravikadam/promptshelf/actions/runs/33937316892) for the exact status, runner details and logs. Release downloads include SHA-256 checksums.

Windows and Linux desktop use and installer flows remain **manually unverified**. The Intel Mac desktop is covered by CI rather than a local manual test. Installer trust prompts, notarization and installation through the DMG/NSIS UI are not covered. macOS builds are ad-hoc signed; Windows builds are unsigned.

## Reproduce

```sh
npm ci
npm test
npm run test:e2e
```

To run against a packaged macOS application:

```sh
PROMPTSHELF_EXECUTABLE="$PWD/release/mac-arm64/PromptShelf.app/Contents/MacOS/PromptShelf" npx playwright test
```

Tests use temporary data directories and remove them afterward. Desktop tests write to the real system clipboard and require a graphical session. Screenshots and failure traces go to `test-results/` (git-ignored).
