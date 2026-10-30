const obsidian = require('obsidian');

// Keep translations in this file so manual installation still needs only three files.
const ENGLISH = {
    "保存版本": "Save version",
    "保存中…": "Saving…",
    "未选择笔记": "No note selected",
    "恢复前备份 {value0}": "Before restore {value0}",
    "自动保存：恢复前的笔记内容": "Automatically saved before restoring a version",
    "恢复已取消：未能保存当前内容的备份": "Restore cancelled: could not back up the current content",
    "当前内容已与此版本相同": "The current content already matches this version",
    "已恢复，并保存了恢复前备份。可在侧栏撤销。": "Restored and backed up the previous content. Undo is available in the sidebar.",
    "已保存恢复前备份，可撤销本次恢复": "The previous content is backed up. You can undo this restore.",
    "撤销恢复": "Undo restore",
    "撤销中…": "Undoing…",
    "已撤销恢复": "Restore undone",
    "恢复后内容已有修改，未执行撤销。请从恢复前备份对比并恢复。": "The note has changed since restoring. Compare with the backup to recover your previous content.",
    "撤销失败: {value0}": "Failed to undo restore: {value0}",
    "恢复 \"{value0}\" 将覆盖当前笔记。继续前会自动保存当前内容的备份。": "Restoring \"{value0}\" will replace this note. Its current content will be backed up first.",
    "旧版本 → 新版本": "Older → Newer",
    "旧版本 · {value0} · {value1}": "Older · {value0} · {value1}",
    "新版本 · {value0} · {value1}": "Newer · {value0} · {value1}",
    "🔍 对比: {value0} → {value1}": "🔍 Compare: {value0} → {value1}",
    "对比: {value0} → {value1}": "Compare: {value0} → {value1}",
    "版本对比: {value0} → {value1}": "Compare: {value0} → {value1}",

    "切换版本视图": "Toggle Version View",
    "已迁移 {value0} 个旧版本记录": "Migrated {value0} old version files",
    "版本 \"{value0}\" 已保存": "Version \"{value0}\" saved",
    "保存版本失败:": "Failed to save version:",
    "保存版本失败: {value0}": "Failed to save version: {value0}",
    "版本不存在": "Version not found",
    "版本信息已更新": "Version information updated",
    "更新版本失败: {value0}": "Failed to update version: {value0}",
    "已恢复到版本 \"{value0}\"": "Restored to version \"{value0}\"",
    "恢复版本失败: {value0}": "Failed to restore version: {value0}",
    "版本已删除": "Version deleted",
    "删除版本失败: {value0}": "Failed to delete version: {value0}",
    "版本视图": "Version View",
    "版本存储文件夹": "Version Storage Folder",
    "版本文件保存的相对路径": "Location where version history is saved",
    "最大版本数量": "Maximum Version Count",
    "超出后自动删除旧版本": "Old versions above this limit will be automatically deleted.",
    "版本名称（可选）": "Version Name (Optional)",
    "保存": "Save",
    "🔍 对比选中版本": "🔍 Compare Selected Versions",
    "请先打开一个笔记": "Please open a note first",
    "保存失败: {value0}": "Save failed: {value0}",
    "暂无版本": "No versions available",
    "编辑": "Edit Version Info",
    "与当前对比": "Compare with Current Version",
    "当前文档": "Current Note",
    "恢复": "Restore this version",
    "确定要恢复到版本 \"{value0}\" 吗？": "Are you sure you want to restore \"{value0}\"?",
    "删除": "Delete Version",
    "确定要删除版本 \"{value0}\" 吗？": "Are you sure you want to delete \"{value0}\"?",
    "最多只能选择 2 个版本进行对比": "You can select at most two versions for comparison",
    "🔍 对比: {value0} vs {value1}": "🔍 Compare: {value0} vs {value1}",
    "编辑版本": "Edit Version Information",
    "版本名称": "Version Name",
    "版本描述": "Version Description",
    "取消": "Cancel",
    "版本名称不能为空": "Version name cannot be empty",
    "对比: {value0} vs {value1}": "Compare: {value0} vs {value1}",
    "版本对比": "Version Compare",
    "请先选择两个版本进行对比": "Please select two versions to compare",
    "版本对比: {value0} vs {value1}": "Compare: {value0} vs {value1}",
    "只显示差异": "Show Only Differences",
    "统一视图": "Unified View",
    "拆分视图": "Split View",
    "两个版本完全相同": "The two versions are identical",
    "行号": "Line"
};

function getInterfaceLanguage() {
    try {
        // Use the public language API; older app versions fall back to English.
        const language = typeof obsidian.getLanguage === 'function'
            ? obsidian.getLanguage()
            : 'en';
        return /^zh(?:[-_]|$)/i.test(language || '') ? 'zh' : 'en';
    } catch (_) {
        return 'en';
    }
}

function t(key, values = {}) {
    const text = getInterfaceLanguage() === 'zh' ? key : (ENGLISH[key] || key);
    return text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
}

function orderVersions(first, second) {
    // The live note is always the destination, even if the system clock has changed.
    if (first.isCurrent !== second.isCurrent && (first.isCurrent || second.isCurrent)) {
        return first.isCurrent ? [second, first] : [first, second];
    }
    return first.timestamp > second.timestamp ||
        (first.timestamp === second.timestamp && first.id > second.id)
        ? [second, first] : [first, second];
}

function versionHeading(version, older) {
    return t(older ? "旧版本 · {value0} · {value1}" : "新版本 · {value0} · {value1}", {
        value0: version.name,
        value1: new Date(version.timestamp).toLocaleString()
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ========== 行级 Diff 算法 (基于 LCS) ==========
function computeDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    const diff = [];
    let i = 0, j = 0;

    while (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        diff.push({ type: 'equal', value: oldLines[i], lineNum: i + 1 });
        i++;
        j++;
    }

    const suffix = [];
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;

    while (oldEnd >= i && newEnd >= j && oldLines[oldEnd] === newLines[newEnd]) {
        suffix.unshift({ type: 'equal', value: oldLines[oldEnd], lineNum: oldEnd + 1 });
        oldEnd--;
        newEnd--;
    }

    const middle = computeLcsDiff(oldLines.slice(i, oldEnd + 1), newLines.slice(j, newEnd + 1), i + 1);
    diff.push(...middle);
    diff.push(...suffix);

    return diff;
}

function computeLcsDiff(oldLines, newLines, startLine) {
    if (oldLines.length === 0) {
        return newLines.map((line, idx) => ({ type: 'added', value: line, lineNum: startLine + idx }));
    }
    if (newLines.length === 0) {
        return oldLines.map((line, idx) => ({ type: 'removed', value: line, lineNum: startLine + idx }));
    }

    const m = oldLines.length;
    const n = newLines.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const temp = [];
    let i = m, j = n;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            temp.unshift({ type: 'equal', value: oldLines[i - 1], lineNum: startLine + i - 1 });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            temp.unshift({ type: 'added', value: newLines[j - 1], lineNum: startLine + j - 1 });
            j--;
        } else if (i > 0) {
            temp.unshift({ type: 'removed', value: oldLines[i - 1], lineNum: startLine + i - 1 });
            i--;
        }
    }

    return temp;
}

// ========== 词级 Diff ==========
function computeWordDiff(oldStr, newStr) {
    const re = /(\s+|[.!?,;:(){}[\]"'`。，；：、！？）】】』」』」』」』」』」])/;
    const oldWords = oldStr.split(re).filter(w => w !== '');
    const newWords = newStr.split(re).filter(w => w !== '');

    if (oldWords.length === 0 && newWords.length === 0) return [{ type: 'equal', value: '' }];
    if (oldWords.length === 0) return newWords.map(w => ({ type: 'added', value: w }));
    if (newWords.length === 0) return oldWords.map(w => ({ type: 'removed', value: w }));

    const m = oldWords.length, n = newWords.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = oldWords[i - 1] === newWords[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
            result.unshift({ type: 'equal', value: oldWords[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: 'added', value: newWords[j - 1] });
            j--;
        } else if (i > 0) {
            result.unshift({ type: 'removed', value: oldWords[i - 1] });
            i--;
        }
    }
    return result;
}

function renderWordHtml(wordDiff, side) {
    return wordDiff.map(t => {
        if (t.type === 'equal') return escapeHtml(t.value);
        if (side === 'old' && t.type === 'removed') return `<del class="version-word-del">${escapeHtml(t.value)}</del>`;
        if (side === 'new' && t.type === 'added') return `<ins class="version-word-ins">${escapeHtml(t.value)}</ins>`;
        if (side === 'old' && t.type === 'added') return '';
        if (side === 'new' && t.type === 'removed') return '';
        return escapeHtml(t.value);
    }).join('');
}

// ========== 版本存储服务 ==========
class VersionService {
    constructor(app, settings) {
        this.app = app;
        this.settings = settings;
        this.pendingWrites = new Map();
        this.restoreUndo = new Map();
    }

    // Serialize writes per note so a backup cannot overwrite a concurrent save.
    _runForFile(file, action) {
        const previous = this.pendingWrites.get(file) || Promise.resolve();
        const next = previous.catch(() => {}).then(action);
        this.pendingWrites.set(file, next);
        const cleanup = () => {
            if (this.pendingWrites.get(file) === next) this.pendingWrites.delete(file);
        };
        next.then(cleanup, cleanup);
        return next;
    }

    saveVersion(file, content, name, description) {
        return this._runForFile(file, () => this._saveVersion(file, content, name, description));
    }

    updateVersion(file, versionId, name, description) {
        return this._runForFile(file, () => this._updateVersion(file, versionId, name, description));
    }

    deleteVersion(file, versionId) {
        return this._runForFile(file, () => this._deleteVersion(file, versionId));
    }

    restoreVersion(version, file) {
        return this._runForFile(file, () => this._restoreVersion(version, file));
    }

    canUndoRestore(file) { return this.restoreUndo.has(file); }

    undoRestore(file) {
        return this._runForFile(file, async () => {
            const undo = this.restoreUndo.get(file);
            if (!undo) return false;
            try {
                if (await this.app.vault.read(file) !== undo.restored) {
                    new obsidian.Notice(t("恢复后内容已有修改，未执行撤销。请从恢复前备份对比并恢复。"));
                    return false;
                }
                await this.app.vault.modify(file, undo.before);
                this.restoreUndo.delete(file);
                new obsidian.Notice(t("已撤销恢复"));
                return true;
            } catch (error) {
                new obsidian.Notice(t("撤销失败: {value0}", { value0: error.message }));
                return false;
            }
        });
    }

    _getVersionDir(file) {
        const safePath = file.path.replace(/\//g, '_');
        return `${this.settings.versionFolder}/${safePath}`;
    }

    _getIndexPath(file) {
        return `${this._getVersionDir(file)}/versions.json`;
    }

    async _ensureDir(dirPath) {
        if (!await this.app.vault.adapter.exists(dirPath)) {
            await this.app.vault.createFolder(dirPath);
        }
    }

    async _readIndex(file) {
        const indexPath = this._getIndexPath(file);
        try {
            if (await this.app.vault.adapter.exists(indexPath)) {
                const data = await this.app.vault.adapter.read(indexPath);
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('[VersionView] Failed to read version index:', e);
        }
        const migrated = await this._migrateOldFormat(file);
        if (migrated) return migrated;
        return { nextId: 1, versions: [] };
    }

    async _migrateOldFormat(file) {
        const dir = this._getVersionDir(file);
        try {
            if (!await this.app.vault.adapter.exists(dir)) return null;
            const entries = await this.app.vault.adapter.list(dir);
            const oldFiles = entries.files.filter(f => f.endsWith('.json') && !f.endsWith('/versions.json'));
            if (oldFiles.length === 0) return null;

            const temp = [];
            for (const filePath of oldFiles) {
                try {
                    const content = await this.app.vault.adapter.read(filePath);
                    const data = JSON.parse(content);
                    temp.push(data);
                } catch (e) {
                    console.error('[VersionView] Failed to migrate old version file:', filePath, e);
                }
            }
            if (temp.length === 0) return null;

            temp.sort((a, b) => a.timestamp - b.timestamp);
            const versions = temp.map((v, i) => ({
                id: i + 1,
                name: v.name || `V${i + 1}`,
                description: v.description || '',
                timestamp: v.timestamp,
                content: v.content
            }));

            const index = { nextId: versions.length + 1, versions };
            await this._writeIndex(file, index);
            new obsidian.Notice(t("已迁移 {value0} 个旧版本记录", { value0: versions.length }));
            return index;
        } catch (e) {
            console.error('[VersionView] Migration failed:', e);
            return null;
        }
    }

    async _writeIndex(file, data) {
        await this.app.vault.adapter.write(this._getIndexPath(file), JSON.stringify(data, null, 2));
    }

    async _saveVersion(file, content, name, description, silent = false) {
        try {
            await this._ensureDir(this.settings.versionFolder);
            await this._ensureDir(this._getVersionDir(file));

            const index = await this._readIndex(file);
            const version = {
                id: index.nextId++,
                name: name,
                description: description || '',
                timestamp: Date.now(),
                content: content
            };
            index.versions.unshift(version);
            await this._writeIndex(file, index);

            if (!silent) new obsidian.Notice(t("版本 \"{value0}\" 已保存", { value0: name }));
            return true;
        } catch (error) {
            console.error(t("保存版本失败:"), error);
            new obsidian.Notice(t("保存版本失败: {value0}", { value0: error.message }));
            return false;
        }
    }

    async _updateVersion(file, versionId, newName, newDescription) {
        try {
            const index = await this._readIndex(file);
            const version = index.versions.find(v => v.id === versionId);
            if (!version) {
                new obsidian.Notice(t("版本不存在"));
                return false;
            }
            version.name = newName;
            version.description = newDescription;
            await this._writeIndex(file, index);
            new obsidian.Notice(t("版本信息已更新"));
            return true;
        } catch (error) {
            new obsidian.Notice(t("更新版本失败: {value0}", { value0: error.message }));
            return false;
        }
    }

    async getVersions(file) {
        const index = await this._readIndex(file);
        return index.versions.sort((a, b) => b.timestamp - a.timestamp);
    }

    async _restoreVersion(versionMeta, file) {
        try {
            const before = await this.app.vault.read(file);
            if (before === versionMeta.content) {
                new obsidian.Notice(t("当前内容已与此版本相同"));
                return false;
            }
            const saved = await this._saveVersion(file, before,
                t("恢复前备份 {value0}", { value0: new Date().toLocaleString() }),
                t("自动保存：恢复前的笔记内容"), true);
            if (!saved) {
                new obsidian.Notice(t("恢复已取消：未能保存当前内容的备份"));
                return false;
            }
            await this.app.vault.modify(file, versionMeta.content);
            this.restoreUndo.set(file, { before, restored: versionMeta.content });
            new obsidian.Notice(t("已恢复，并保存了恢复前备份。可在侧栏撤销。"));
            return true;
        } catch (error) {
            new obsidian.Notice(t("恢复版本失败: {value0}", { value0: error.message }));
            return false;
        }
    }

    async _deleteVersion(file, versionId) {
        try {
            const index = await this._readIndex(file);
            index.versions = index.versions.filter(v => v.id !== versionId);
            await this._writeIndex(file, index);
            new obsidian.Notice(t("版本已删除"));
            return true;
        } catch (error) {
            new obsidian.Notice(t("删除版本失败: {value0}", { value0: error.message }));
            return false;
        }
    }
}

// ========== 插件主类 ==========
class VersionViewPlugin extends obsidian.Plugin {
    async onload() {
        await this.loadSettings();

        this.versionService = new VersionService(this.app, this.settings);

        this.registerView(VersionViewPane.VIEW_TYPE, (leaf) => {
            return new VersionViewPane(leaf, this);
        });

        this.registerView(DiffViewPane.VIEW_TYPE, (leaf) => {
            return new DiffViewPane(leaf, this);
        });

        this.addRibbonIcon('clock', t("版本视图"), () => {
            this.activateView();
        });

        this.addCommand({
            id: 'toggle-version-view',
            name: t("切换版本视图"),
            callback: () => {
                this.activateView();
            }
        });

        this.addSettingTab(new VersionViewSettingTab(this.app, this));
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VersionViewPane.VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(DiffViewPane.VIEW_TYPE);
    }

    async loadSettings() {
        this.settings = Object.assign({}, {
            versionFolder: '.res/versions',
            maxVersions: 50,
            autoSave: false
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VersionViewPane.VIEW_TYPE)[0];
        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VersionViewPane.VIEW_TYPE, active: true });
        }
        workspace.revealLeaf(leaf);
    }

    async openDiffView(version1, version2) {
        [version1, version2] = orderVersions(version1, version2);
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
            type: DiffViewPane.VIEW_TYPE,
            active: true,
            state: { version1, version2 }
        });
        const view = leaf.view;
        if (view instanceof DiffViewPane) {
            view.version1 = version1;
            view.version2 = version2;
            view.diff = computeDiff(version1.content, version2.content);
            view.groups = view.groupDiffLines(view.diff);
            view.processedLines = view.processGroups(view.groups);
            view.renderContent();
        }
    }
}

// ========== 设置面板 ==========
class VersionViewSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const {containerEl} = this;
        containerEl.empty();

        new obsidian.Setting(containerEl)
            .setName(t("版本存储文件夹"))
            .setDesc(t("版本文件保存的相对路径"))
            .addText(text => text
                .setPlaceholder('.res/versions')
                .setValue(this.plugin.settings.versionFolder)
                .onChange(async (value) => {
                    this.plugin.settings.versionFolder = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName(t("最大版本数量"))
            .setDesc(t("超出后自动删除旧版本"))
            .addSlider(slider => slider
                .setLimits(1, 100, 1)
                .setValue(this.plugin.settings.maxVersions)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxVersions = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// ========== 版本视图侧边栏 ==========
class VersionViewPane extends obsidian.ItemView {
    static VIEW_TYPE = 'version-view';

    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.file = null;
        this.versions = [];
        this.selectedVersions = [];
    }

    getViewType() { return VersionViewPane.VIEW_TYPE; }
    getDisplayText() { return t("版本视图"); }
    getIcon() { return 'clock'; }

    async onOpen() {
        this.buildUI();

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.refresh();
            })
        );

        await this.refresh();
    }

    buildUI() {
        const {contentEl} = this;
        contentEl.addClass('version-view-container');

        const headerEl = contentEl.createDiv({ cls: 'version-view-header' });
        headerEl.createSpan({ cls: 'version-view-title', text: t("版本视图") });
        this.fileLabel = headerEl.createDiv({ cls: 'version-view-file', text: t("未选择笔记") });

        const inputContainer = contentEl.createDiv({ cls: 'version-view-input-container' });
        this.nameInput = inputContainer.createEl('input', {
            type: 'text',
            cls: 'version-view-name-input',
            attr: { placeholder: t("版本名称（可选）") }
        });

        this.saveBtn = inputContainer.createEl('button', { cls: 'version-view-save-btn', text: t("保存版本") });
        this.saveBtn.addEventListener('click', () => this.saveCurrentVersion());
        this.updateSaveState();

        this.undoContainer = contentEl.createDiv({ cls: 'version-view-undo' });
        this.undoContainer.style.display = 'none';
        this.undoContainer.createSpan({ text: t("已保存恢复前备份，可撤销本次恢复") });
        this.undoBtn = this.undoContainer.createEl('button', { text: t("撤销恢复") });
        this.undoBtn.addEventListener('click', () => this.undoLastRestore());

        this.compareBtn = contentEl.createEl('button', {
            cls: 'version-view-compare-btn',
            text: t("🔍 对比选中版本")
        });
        this.compareBtn.style.display = 'none';
        this.compareBtn.addEventListener('click', () => this.compareSelected());

        this.listEl = contentEl.createDiv({ cls: 'version-view-list' });

        this.emptyEl = contentEl.createDiv({ cls: 'version-view-placeholder' });
        this.emptyEl.style.display = 'none';
    }

    updateSaveState() {
        this.saveBtn.disabled = !this.file || !!this.isSaving;
        this.nameInput.disabled = !this.file || !!this.isSaving;
        this.saveBtn.setText(t(this.isSaving ? "保存中…" : "保存版本"));
        this.saveBtn.setAttribute('aria-busy', String(!!this.isSaving));
    }

    updateUndoState() {
        this.undoContainer.style.display = this.file &&
            this.plugin.versionService.canUndoRestore(this.file) ? '' : 'none';
    }

    async undoLastRestore() {
        const file = this.file;
        if (!file || this.isUndoing) return;
        this.isUndoing = true;
        this.undoBtn.disabled = true;
        this.undoBtn.setText(t("撤销中…"));
        try {
            await this.plugin.versionService.undoRestore(file);
            if (this.file === file) await this.loadVersions();
        } finally {
            this.isUndoing = false;
            this.undoBtn.disabled = false;
            this.undoBtn.setText(t("撤销恢复"));
            this.updateUndoState();
        }
    }

    async refresh() {
        const previous = this.file;
        this.file = this.app.workspace.getActiveFile();
        if (this.file !== previous) {
            this._loadGen = (this._loadGen || 0) + 1;
            this.versions = [];
            this.selectedVersions = [];
            this.listEl.empty();
            this.compareBtn.style.display = 'none';
            this.nameInput.value = '';
        }
        this.fileLabel.setText(this.file ? this.file.basename || this.file.name : t("未选择笔记"));
        this.fileLabel.title = this.file ? this.file.path : '';
        this.updateSaveState();
        this.updateUndoState();
        if (!this.file) {
            this.listEl.empty();
            this.listEl.style.display = 'none';
            this.emptyEl.style.display = 'block';
            this.emptyEl.setText(t("请先打开一个笔记"));
            this.compareBtn.style.display = 'none';
            return;
        }
        this.emptyEl.style.display = 'none';
        this.listEl.style.display = '';
        await this.loadVersions();
    }

    async saveCurrentVersion() {
        const file = this.file;
        if (!file || this.isSaving) return;
        const name = this.nameInput.value.trim() || `V${this.versions.length + 1}`;
        this.isSaving = true;
        this.updateSaveState();
        try {
            const content = await this.app.vault.read(file);
            const success = await this.plugin.versionService.saveVersion(file, content, name, '');
            if (success && this.file === file) {
                await this.loadVersions();
                if (this.file === file) this.nameInput.value = '';
            }
        } catch (error) {
            new obsidian.Notice(t("保存失败: {value0}", { value0: error.message }));
        } finally {
            this.isSaving = false;
            this.updateSaveState();
        }
    }

    async loadVersions() {
        this._loadGen = (this._loadGen || 0) + 1;
        const gen = this._loadGen;

        const file = this.file;
        if (!file) return;
        const versions = await this.plugin.versionService.getVersions(file);
        if (gen !== this._loadGen || file !== this.file) return;
        this.versions = versions;
        this.updateUndoState();

        this.listEl.empty();
        this.selectedVersions = [];
        this.compareBtn.style.display = 'none';

        if (this.versions.length === 0) {
            this.listEl.createEl('p', { text: t("暂无版本") });
            return;
        }

        for (const version of this.versions) {
            const card = this.listEl.createDiv({ cls: 'version-item-card' });
            const row1 = card.createDiv({ cls: 'version-item-row1' });

            const checkbox = row1.createEl('input', { type: 'checkbox', cls: 'version-item-checkbox' });
            const tag = row1.createDiv({ cls: 'version-item-tag' });
            tag.setText(`V${version.id}`);
            const nameEl = row1.createDiv({ cls: 'version-item-name' });
            nameEl.setText(version.name);
            const buttonsEl = row1.createDiv({ cls: 'version-item-actions' });

            const editBtn = buttonsEl.createEl('button', { text: '✏️', cls: 'version-item-btn' });
            editBtn.title = t("编辑");
            editBtn.addEventListener('click', () => {
                new EditVersionModal(this.app, version, {
                    update: (v, name, desc) => this.plugin.versionService.updateVersion(file, v.id, name, desc),
                    onDone: () => this.file === file && this.loadVersions()
                }).open();
            });

            const diffBtn = buttonsEl.createEl('button', { text: '🔍', cls: 'version-item-btn' });
            diffBtn.title = t("与当前对比");
            diffBtn.addEventListener('click', async () => {
                const currentContent = await this.app.vault.read(file);
                this.plugin.openDiffView(version, {
                    name: t("当前文档"),
                    timestamp: Date.now(),
                    content: currentContent,
                    isCurrent: true
                });
            });

            const restoreBtn = buttonsEl.createEl('button', { text: '↩️', cls: 'version-item-btn' });
            restoreBtn.title = t("恢复");
            restoreBtn.addEventListener('click', async () => {
                if (this.isRestoring) return;
                if (!confirm(t('恢复 "{value0}" 将覆盖当前笔记。继续前会自动保存当前内容的备份。', { value0: version.name }))) return;
                this.isRestoring = true;
                restoreBtn.disabled = true;
                try {
                    await this.plugin.versionService.restoreVersion(version, file);
                    if (this.file === file) await this.loadVersions();
                } finally {
                    this.isRestoring = false;
                    restoreBtn.disabled = false;
                }
            });

            const deleteBtn = buttonsEl.createEl('button', { text: '🗑️', cls: 'version-item-btn' });
            deleteBtn.title = t("删除");
            deleteBtn.addEventListener('click', async () => {
                if (confirm(t("确定要删除版本 \"{value0}\" 吗？", { value0: version.name }))) {
                    await this.plugin.versionService.deleteVersion(file, version.id);
                    if (this.file === file) await this.loadVersions();
                }
            });

            if (version.description) {
                card.createDiv({ cls: 'version-item-desc', text: version.description });
            }
            card.createDiv({ cls: 'version-item-time', text: new Date(version.timestamp).toLocaleString() });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (this.selectedVersions.length >= 2) {
                        checkbox.checked = false;
                        new obsidian.Notice(t("最多只能选择 2 个版本进行对比"));
                        return;
                    }
                    this.selectedVersions.push(version);
                } else {
                    this.selectedVersions = this.selectedVersions.filter(v => v.id !== version.id);
                }
                this.updateCompareBtn();
            });
        }

        this.updateCompareBtn();
    }

    updateCompareBtn() {
        if (this.selectedVersions.length === 2) {
            this.compareBtn.style.display = 'block';
            const [older, newer] = orderVersions(...this.selectedVersions);
            this.compareBtn.textContent = t("🔍 对比: {value0} → {value1}", { value0: older.name, value1: newer.name });
        } else {
            this.compareBtn.style.display = 'none';
        }
    }

    compareSelected() {
        if (this.selectedVersions.length === 2) {
            this.plugin.openDiffView(this.selectedVersions[0], this.selectedVersions[1]);
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

// ========== 编辑版本模态框 ==========
class EditVersionModal extends obsidian.Modal {
    constructor(app, version, callbacks) {
        super(app);
        this.version = version;
        this.callbacks = callbacks;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.createEl('h2', {text: t("编辑版本")});

        contentEl.createEl('label', {text: t("版本名称")});
        const nameInput = contentEl.createEl('input', {
            type: 'text', value: this.version.name,
            cls: 'modal-input'
        });

        contentEl.createEl('label', {text: t("版本描述")});
        const descInput = contentEl.createEl('textarea', { cls: 'modal-textarea' });
        descInput.value = this.version.description || '';

        const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        const cancelBtn = btnContainer.createEl('button', { text: t("取消"), cls: 'modal-cancel-btn' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = btnContainer.createEl('button', { text: t("保存"), cls: 'modal-save-btn' });
        saveBtn.addEventListener('click', async () => {
            const newName = nameInput.value.trim();
            if (!newName) {
                new obsidian.Notice(t("版本名称不能为空"));
                return;
            }
            const success = await this.callbacks.update(this.version, newName, descInput.value.trim());
            if (success) {
                this.callbacks.onDone();
                this.close();
            }
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

// ========== 差异对比视图 ==========
class FrontmatterTracker {
    constructor() {
        this._inside = false;
        this._seen = false;
    }

    next(lineText) {
        const stripped = lineText.trim();
        if (stripped === '---') {
            if (!this._seen) {
                this._seen = true;
                this._inside = true;
                return true;
            } else if (this._inside) {
                this._inside = false;
                return true;
            }
        }
        return this._inside;
    }
}

class DiffViewPane extends obsidian.ItemView {
    static VIEW_TYPE = 'version-diff';

    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.version1 = null;
        this.version2 = null;
        this.showOnlyDiff = true;
        this.viewMode = 'split';
    }

    getViewType() { return DiffViewPane.VIEW_TYPE; }
    getDisplayText() {
        if (this.version1 && this.version2) {
            return t("对比: {value0} → {value1}", { value0: this.version1.name, value1: this.version2.name });
        }
        return t("版本对比");
    }
    getIcon() { return 'file-search'; }

    getState() {
        return { version1: this.version1, version2: this.version2 };
    }

    setState(state, result) {
        [this.version1, this.version2] = state.version1 && state.version2
            ? orderVersions(state.version1, state.version2) : [state.version1, state.version2];
        super.setState(state, result);
    }

    async onOpen() {
        this.contentEl.empty();
        if (!this.version1 || !this.version2) {
            this.contentEl.createDiv({ cls: 'version-view-placeholder', text: t("请先选择两个版本进行对比") });
            return;
        }
        this.renderContent();
    }

    groupDiffLines(diff) {
        const groups = [];
        let currentGroup = null;

        for (const item of diff) {
            if (currentGroup && currentGroup.type === item.type) {
                currentGroup.value += '\n' + item.value;
            } else {
                currentGroup = { type: item.type, value: item.value };
                groups.push(currentGroup);
            }
        }

        return groups;
    }

    processGroups(groups) {
        const lines = [];
        let oldLineNum = 1;
        let newLineNum = 1;

        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            if (g.type === 'equal') {
                const items = g.value.split('\n');
                for (const val of items) {
                    lines.push({ type: 'equal', value: val, oldLineNum: oldLineNum++, newLineNum: newLineNum++ });
                }
            } else if (g.type === 'removed' && i + 1 < groups.length && groups[i + 1].type === 'added') {
                const nextG = groups[i + 1];
                const oldItems = g.value.split('\n');
                const newItems = nextG.value.split('\n');
                const maxLen = Math.max(oldItems.length, newItems.length);
                for (let j = 0; j < maxLen; j++) {
                    const oldVal = j < oldItems.length ? oldItems[j] : '';
                    const newVal = j < newItems.length ? newItems[j] : '';
                    let wordDiff = null;
                    if (oldVal !== '' && newVal !== '') {
                        wordDiff = computeWordDiff(oldVal, newVal);
                    }
                    lines.push({
                        type: 'changed',
                        oldVal, newVal, wordDiff,
                        oldLineNum: oldVal !== '' ? oldLineNum : null,
                        newLineNum: newVal !== '' ? newLineNum : null
                    });
                    if (oldVal !== '') oldLineNum++;
                    if (newVal !== '') newLineNum++;
                }
                i++;
            } else if (g.type === 'removed') {
                const items = g.value.split('\n');
                for (const val of items) {
                    lines.push({ type: 'removed', value: val, oldLineNum: oldLineNum++, newLineNum: null });
                }
            } else if (g.type === 'added') {
                const items = g.value.split('\n');
                for (const val of items) {
                    lines.push({ type: 'added', value: val, oldLineNum: null, newLineNum: newLineNum++ });
                }
            }
        }

        return lines;
    }

    renderContent() {
        const {contentEl} = this;
        contentEl.empty();

        const headerEl = contentEl.createDiv({ cls: 'diff-header' });
        headerEl.createEl('h2', { text: t("版本对比: {value0} → {value1}", { value0: this.version1.name, value1: this.version2.name }) });

        headerEl.createDiv({ cls: 'diff-direction', text: t("旧版本 → 新版本") });

        const controlsEl = headerEl.createDiv({ cls: 'diff-controls' });

        const diffToggleLabel = controlsEl.createEl('label', { cls: 'diff-toggle-label' });
        const diffToggle = diffToggleLabel.createEl('input', { type: 'checkbox' });
        diffToggle.checked = this.showOnlyDiff;
        diffToggle.addEventListener('change', () => {
            this.showOnlyDiff = diffToggle.checked;
            this.renderContent();
        });
        diffToggleLabel.createSpan({ text: t("只显示差异") });

        const viewBtn = controlsEl.createEl('button', {
            cls: 'diff-view-btn',
            text: this.viewMode === 'split' ? t("统一视图") : t("拆分视图")
        });
        viewBtn.addEventListener('click', () => {
            this.viewMode = this.viewMode === 'split' ? 'unified' : 'split';
            this.renderContent();
        });

        const container = contentEl.createDiv({ cls: 'diff-container' });

        const filtered = this.showOnlyDiff
            ? this.processedLines.filter(l => l.type !== 'equal')
            : this.processedLines;

        if (filtered.length === 0) {
            container.createDiv({ cls: 'diff-empty', text: t("两个版本完全相同") });
            return;
        }

        if (this.viewMode === 'split') {
            this.renderSplitView(container, filtered);
        } else {
            this.renderUnifiedView(container, filtered);
        }
    }

    renderSplitView(container, lines) {
        const table = container.createDiv({ cls: 'diff-table' });

        const headerRow = table.createDiv({ cls: 'diff-header-row' });
        headerRow.createDiv({ cls: 'diff-cell-line-num', text: t("行号") });
        headerRow.createDiv({ cls: 'diff-cell-content', text: versionHeading(this.version1, true) });
        headerRow.createDiv({ cls: 'diff-cell-line-num', text: t("行号") });
        headerRow.createDiv({ cls: 'diff-cell-content', text: versionHeading(this.version2, false) });

        const body = container.createDiv({ cls: 'diff-body' });

        const oldFm = new FrontmatterTracker();
        const newFm = new FrontmatterTracker();

        for (const line of lines) {
            const row = body.createDiv({ cls: 'diff-row' });

            if (line.type === 'equal') {
                const isFm = oldFm.next(line.value);
                newFm.next(line.value);
                if (isFm) row.addClass('version-diff-frontmatter');

                row.createDiv({ cls: 'diff-cell-line-num', text: String(line.oldLineNum) });
                row.createDiv({ cls: 'diff-cell-content', text: line.value });
                row.createDiv({ cls: 'diff-cell-line-num', text: String(line.newLineNum) });
                row.createDiv({ cls: 'diff-cell-content', text: line.value });

            } else if (line.type === 'removed') {
                const isFm = oldFm.next(line.value);
                if (isFm) row.addClass('version-diff-frontmatter');
                row.addClass('diff-row-del');

                row.createDiv({ cls: 'diff-cell-line-num diff-num-del', text: String(line.oldLineNum) });
                row.createDiv({ cls: 'diff-cell-content diff-content-del', text: line.value });
                row.createDiv({ cls: 'diff-cell-line-num', text: '' });
                row.createDiv({ cls: 'diff-cell-content', text: '' });

            } else if (line.type === 'added') {
                const isFm = newFm.next(line.value);
                if (isFm) row.addClass('version-diff-frontmatter');
                row.addClass('diff-row-ins');

                row.createDiv({ cls: 'diff-cell-line-num', text: '' });
                row.createDiv({ cls: 'diff-cell-content', text: '' });
                row.createDiv({ cls: 'diff-cell-line-num diff-num-ins', text: String(line.newLineNum) });
                row.createDiv({ cls: 'diff-cell-content diff-content-ins', text: line.value });

            } else if (line.type === 'changed') {
                if (line.oldVal !== '') {
                    const isFm = oldFm.next(line.oldVal);
                    if (isFm) row.addClass('version-diff-frontmatter');
                }
                if (line.newVal !== '') {
                    newFm.next(line.newVal);
                }
                row.addClass('diff-row-changed');

                if (line.wordDiff) {
                    row.createDiv({ cls: 'diff-cell-line-num diff-num-del', text: String(line.oldLineNum) });
                    const oldCell = row.createDiv({ cls: 'diff-cell-content diff-content-del' });
                    oldCell.innerHTML = renderWordHtml(line.wordDiff, 'old');

                    row.createDiv({ cls: 'diff-cell-line-num diff-num-ins', text: String(line.newLineNum) });
                    const newCell = row.createDiv({ cls: 'diff-cell-content diff-content-ins' });
                    newCell.innerHTML = renderWordHtml(line.wordDiff, 'new');
                } else {
                    row.createDiv({ cls: 'diff-cell-line-num diff-num-del', text: line.oldVal !== '' ? String(line.oldLineNum) : '' });
                    row.createDiv({ cls: 'diff-cell-content diff-content-del', text: line.oldVal });

                    row.createDiv({ cls: 'diff-cell-line-num diff-num-ins', text: line.newVal !== '' ? String(line.newLineNum) : '' });
                    row.createDiv({ cls: 'diff-cell-content diff-content-ins', text: line.newVal });
                }
            }
        }
    }

    renderUnifiedView(container, lines) {
        container.createDiv({ cls: 'diff-version-summary', text: `${versionHeading(this.version1, true)} → ${versionHeading(this.version2, false)}` });
        const body = container.createDiv({ cls: 'diff-body' });

        const oldFm = new FrontmatterTracker();
        const newFm = new FrontmatterTracker();

        for (const line of lines) {
            if (line.type === 'equal') {
                const isFm = oldFm.next(line.value);
                newFm.next(line.value);
                const row = body.createDiv({ cls: 'diff-row' });
                if (isFm) row.addClass('version-diff-frontmatter');
                row.createDiv({ cls: 'diff-unified-line-num', text: String(line.oldLineNum) });
                row.createDiv({ cls: 'diff-unified-prefix' });
                row.createDiv({ cls: 'diff-cell-content', text: line.value });

            } else if (line.type === 'removed') {
                const isFm = oldFm.next(line.value);
                const row = body.createDiv({ cls: 'diff-row diff-row-del' });
                if (isFm) row.addClass('version-diff-frontmatter');
                row.createDiv({ cls: 'diff-unified-line-num diff-num-del', text: String(line.oldLineNum) });
                row.createDiv({ cls: 'diff-unified-prefix diff-prefix-del', text: '-' });
                row.createDiv({ cls: 'diff-cell-content diff-content-del', text: line.value });

            } else if (line.type === 'added') {
                const isFm = newFm.next(line.value);
                const row = body.createDiv({ cls: 'diff-row diff-row-ins' });
                if (isFm) row.addClass('version-diff-frontmatter');
                row.createDiv({ cls: 'diff-unified-line-num diff-num-ins', text: String(line.newLineNum) });
                row.createDiv({ cls: 'diff-unified-prefix diff-prefix-ins', text: '+' });
                row.createDiv({ cls: 'diff-cell-content diff-content-ins', text: line.value });

            } else if (line.type === 'changed') {
                if (line.oldVal !== '') {
                    const isFm = oldFm.next(line.oldVal);
                    const row = body.createDiv({ cls: 'diff-row diff-row-del' });
                    if (isFm) row.addClass('version-diff-frontmatter');
                    row.createDiv({ cls: 'diff-unified-line-num diff-num-del', text: String(line.oldLineNum) });
                    row.createDiv({ cls: 'diff-unified-prefix diff-prefix-del', text: '-' });
                    const cell = row.createDiv({ cls: 'diff-cell-content diff-content-del' });
                    if (line.wordDiff) {
                        cell.innerHTML = renderWordHtml(line.wordDiff, 'old');
                    } else {
                        cell.textContent = line.oldVal;
                    }
                }
                if (line.newVal !== '') {
                    const isFm = newFm.next(line.newVal);
                    const row = body.createDiv({ cls: 'diff-row diff-row-ins' });
                    if (isFm) row.addClass('version-diff-frontmatter');
                    row.createDiv({ cls: 'diff-unified-line-num diff-num-ins', text: String(line.newLineNum) });
                    row.createDiv({ cls: 'diff-unified-prefix diff-prefix-ins', text: '+' });
                    const cell = row.createDiv({ cls: 'diff-cell-content diff-content-ins' });
                    if (line.wordDiff) {
                        cell.innerHTML = renderWordHtml(line.wordDiff, 'new');
                    } else {
                        cell.textContent = line.newVal;
                    }
                }
            }
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

module.exports = VersionViewPlugin;
