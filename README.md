# Version View for Obsidian

> **Note:** This community-maintained rebuild is based on the original Version View plugin by [joeytoday](https://github.com/joeytoday). The original repository was missing `main.js`, so this implementation was rebuilt using AI. The maintained repository, releases, and issue tracker are at [maoqingwei/obsidian-version-view](https://github.com/maoqingwei/obsidian-version-view).

A simple version control plugin for Obsidian. Save, manage, compare and restore file versions with an intuitive interface.

[简体中文](README_zh.md)

## Language

The interface follows Obsidian’s language setting: Chinese (`zh`, including regional variants) uses Simplified Chinese; other languages use English. Automatic language detection uses the public API available in Obsidian 1.8.7 and later; older versions fall back to English. After changing the app language, restart Obsidian to refresh all labels. Saved version names, descriptions, and note content are preserved.

English translations adapted from [ThisIsKenta’s contribution in PR #2](https://github.com/maoqingwei/obsidian-version-view/pull/2).

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
2. Click the clock icon 🕐 in the ribbon, or run the command "Toggle Version View"
3. Enter a version name (optional) and click "Save version"
4. Use the action buttons for each version:
   - ✏️ Edit version name and description
   - 🔍 Compare with current document
   - ↩️ Restore to this version
   - 🗑️ Delete this version
5. Select two versions with checkboxes to compare them directly

## Saving, comparing, and restoring

- The sidebar identifies the active note. While a version is being saved, the save button shows “Saving…” and ignores repeated clicks.
- Comparisons always show the older version on the left and the newer version on the right, with names and timestamps. Comparing against the current note always puts the current note on the right. Red indicates removed content and green indicates added content from older to newer.
- Before restoring, the plugin saves the current note as a “Before restore” version. If the backup fails, the note is not replaced.
- Use **Undo restore** in the sidebar to undo the most recent restore for that note during the current plugin session. If you have edited the note since restoring, undo leaves those edits intact; compare with the backup to recover earlier content. The saved backup remains in the version list after restarting Obsidian.

## Settings

- **Version Storage Folder** - Where version files are stored (default: `res/versions`)
- **Maximum Versions** - Auto-delete old versions when exceeding this limit (default: 50)

## License

MIT
