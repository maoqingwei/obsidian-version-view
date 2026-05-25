# Version View for Obsidian

> **Note:** This is a community-maintained fork of the original [Version View](https://github.com/maoqingwei/obsidian-version-view) plugin by [joeytoday](https://github.com/joeytoday). The original repository was missing the `main.js` file, so this plugin has been rebuilt from scratch using AI to provide a fully functional version with all features intact.

A simple version control plugin for Obsidian. Save, manage, compare and restore file versions with an intuitive interface.

## Features

- **Save Version Snapshots** - Save current file version with optional name
- **Visual Version Comparison** - Side-by-side diff with line numbers, highlighting added (green) and removed (red) content
- **One-Click Restore** - Revert to any previous version instantly
- **Edit Version Info** - Update version name and description
- **Compare Any Two Versions** - Select two versions to compare, or compare with current document
- **Fullscreen Diff View** - Toggle fullscreen mode for better readability
- **Show Only Differences** - Filter to show only changed lines
- **Frontmatter-Aware Diff** - YAML frontmatter is visually distinguished for cleaner comparison
- **Configurable Settings** - Set version storage folder and maximum version count

## Installation

### Community Plugin Store (Recommended)

1. Open **Settings → Community plugins**
2. Click **Browse** and search for "Version View"
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/maoqingwei/obsidian-version-view/releases)
2. Create a folder `version-view` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the `version-view` folder
4. Enable the plugin in Settings → Community plugins

### BRAT Installation

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Add this repository: `https://github.com/maoqingwei/obsidian-version-view`

## Usage

1. Open any note
2. Click the clock icon 🕐 in the ribbon, or run the command "切换版本视图"
3. Enter a version name (optional) and click "保存此版本"
4. Use the action buttons for each version:
   - ✏️ Edit version name and description
   - 🔍 Compare with current document
   - ↩️ Restore to this version
   - 🗑️ Delete this version
5. Select two versions with checkboxes to compare them directly

## Settings

- **Version Storage Folder** - Where version files are stored (default: `res/versions`)
- **Maximum Versions** - Auto-delete old versions when exceeding this limit (default: 50)

## License

MIT
