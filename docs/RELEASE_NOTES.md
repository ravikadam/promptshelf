PromptShelf is a small, offline desktop app for saving, finding, filling and copying reusable AI prompts. No login or AI API key is needed.

### Choose your download

| Computer | Download |
| --- | --- |
| Mac with Apple Silicon (M1/M2/M3/M4 or later) | `PromptShelf-1.0.0-mac-arm64.dmg` |
| Mac with an Intel processor | `PromptShelf-1.0.0-mac-x64.dmg` |
| Windows PC (Intel/AMD, 64-bit) | `PromptShelf-1.0.0-win-x64.exe` |
| Linux PC (Intel/AMD, 64-bit) | `PromptShelf-1.0.0-linux-x64.AppImage` |

Download the installer for your computer from **Assets** below. GitHub's “Source code” archives are for developers. `SHA256SUMS.txt` contains the installer checksums.

### Install

- **macOS:** Open the DMG and drag PromptShelf into Applications. This community build is ad-hoc signed, not Apple-notarized. If macOS blocks it, follow [Apple's instructions for apps from an unidentified developer](https://support.apple.com/en-gb/102445), only if you trust this download. Do not disable Gatekeeper globally.
- **Windows:** Open the `.exe` installer. This build is unsigned, so Windows may show an unknown-publisher or SmartScreen warning. Only proceed if you trust this release.
- **Linux:** Make the AppImage executable (`chmod +x PromptShelf-1.0.0-linux-x64.AppImage`) and launch it. Your distribution may need FUSE support. If sandbox restrictions prevent launch, report your distribution and error; do not disable the sandbox as a workaround.

### What to try

Open one of the six starter prompts, fill its fields and copy it into your preferred AI tool. You can also create prompts, use favourites and tags, and export/import your library.

Prompts stay on your computer in a local JSON file. Field values are not saved. Export a backup before replacing the app or experimenting with imported libraries. Updates are manual: download a newer release and replace the app; keep the application-data directory to retain prompts.

### Verification and limitations

The app and packaged application were tested locally on macOS Apple Silicon. Automated builds run on each target OS, with desktop acceptance tests on macOS. Windows and Linux installers are not yet manually tested. Signing/notarization and installer trust warnings are not covered by the tests.

Please report problems in [GitHub Issues](https://github.com/ravikadam/promptshelf/issues), including your OS, app version and steps to reproduce. Avoid attaching private prompt content.
