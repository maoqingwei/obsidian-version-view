const obsidian = require('obsidian');

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
            new obsidian.Notice(`已迁移 ${versions.length} 个旧版本记录`);
            return index;
        } catch (e) {
            console.error('[VersionView] Migration failed:', e);
            return null;
        }
    }

    async _writeIndex(file, data) {
        await this.app.vault.adapter.write(this._getIndexPath(file), JSON.stringify(data, null, 2));
    }

    async saveVersion(file, content, name, description) {
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

            new obsidian.Notice(`版本 "${name}" 已保存`);
            return true;
        } catch (error) {
            console.error('保存版本失败:', error);
            new obsidian.Notice(`保存版本失败: ${error.message}`);
            return false;
        }
    }

    async updateVersion(file, versionId, newName, newDescription) {
        try {
            const index = await this._readIndex(file);
            const version = index.versions.find(v => v.id === versionId);
            if (!version) {
                new obsidian.Notice('版本不存在');
                return false;
            }
            version.name = newName;
            version.description = newDescription;
            await this._writeIndex(file, index);
            new obsidian.Notice('版本信息已更新');
            return true;
        } catch (error) {
            new obsidian.Notice(`更新版本失败: ${error.message}`);
            return false;
        }
    }

    async getVersions(file) {
        const index = await this._readIndex(file);
        return index.versions.sort((a, b) => b.timestamp - a.timestamp);
    }

    async restoreVersion(versionMeta, file) {
        try {
            await this.app.vault.modify(file, versionMeta.content);
            new obsidian.Notice(`已恢复到版本 "${versionMeta.name}"`);
            return true;
        } catch (error) {
            new obsidian.Notice(`恢复版本失败: ${error.message}`);
            return false;
        }
    }

    async deleteVersion(file, versionId) {
        try {
            const index = await this._readIndex(file);
            index.versions = index.versions.filter(v => v.id !== versionId);
            await this._writeIndex(file, index);
            new obsidian.Notice('版本已删除');
            return true;
        } catch (error) {
            new obsidian.Notice(`删除版本失败: ${error.message}`);
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

        this.addRibbonIcon('clock', '版本视图', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'toggle-version-view',
            name: '切换版本视图',
            callback: () => {
                this.activateView();
            }
        });

        this.addSettingTab(new VersionViewSettingTab(this.app, this));
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VersionViewPane.VIEW_TYPE);
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
            .setName('版本存储文件夹')
            .setDesc('版本文件保存的相对路径')
            .addText(text => text
                .setPlaceholder('.res/versions')
                .setValue(this.plugin.settings.versionFolder)
                .onChange(async (value) => {
                    this.plugin.settings.versionFolder = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('最大版本数量')
            .setDesc('超出后自动删除旧版本')
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
    getDisplayText() { return '版本视图'; }
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
        headerEl.createSpan({ cls: 'version-view-title', text: '版本视图' });

        const inputContainer = contentEl.createDiv({ cls: 'version-view-input-container' });
        this.nameInput = inputContainer.createEl('input', {
            type: 'text',
            cls: 'version-view-name-input',
            attr: { placeholder: '版本名称（可选）' }
        });

        const saveBtn = inputContainer.createEl('button', { cls: 'version-view-save-btn', text: '保存' });
        saveBtn.addEventListener('click', () => this.saveCurrentVersion());

        this.compareBtn = contentEl.createEl('button', {
            cls: 'version-view-compare-btn',
            text: '🔍 对比选中版本'
        });
        this.compareBtn.style.display = 'none';
        this.compareBtn.addEventListener('click', () => this.compareSelected());

        this.listEl = contentEl.createDiv({ cls: 'version-view-list' });

        this.emptyEl = contentEl.createDiv({ cls: 'version-view-placeholder' });
        this.emptyEl.setText('暂无版本');
    }

    async refresh() {
        this.file = this.app.workspace.getActiveFile();
        if (!this.file) {
            this.listEl.empty();
            this.listEl.style.display = 'none';
            this.emptyEl.style.display = 'block';
            this.emptyEl.setText('请先打开一个笔记');
            this.compareBtn.style.display = 'none';
            return;
        }
        this.emptyEl.style.display = 'none';
        this.listEl.style.display = '';
        await this.loadVersions();
    }

    async saveCurrentVersion() {
        const file = this.file;
        if (!file) return;

        try {
            const name = this.nameInput.value.trim() || `V${this.versions.length + 1}`;
            const content = await this.app.vault.read(file);
            const vs = this.plugin.versionService;
            const success = await vs.saveVersion(file, content, name, '');
            if (success) {
                await this.loadVersions();
                this.nameInput.value = '';
            }
        } catch (error) {
            new obsidian.Notice(`保存失败: ${error.message}`);
        }
    }

    async loadVersions() {
        this.listEl.empty();
        this.versions = await this.plugin.versionService.getVersions(this.file);
        this.selectedVersions = [];
        this.compareBtn.style.display = 'none';

        if (this.versions.length === 0) {
            this.listEl.createEl('p', { text: '暂无版本' });
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
            editBtn.title = '编辑';
            editBtn.addEventListener('click', () => {
                new EditVersionModal(this.app, version, {
                    update: (v, name, desc) => this.plugin.versionService.updateVersion(this.file, v.id, name, desc),
                    onDone: () => this.loadVersions()
                }).open();
            });

            const diffBtn = buttonsEl.createEl('button', { text: '🔍', cls: 'version-item-btn' });
            diffBtn.title = '与当前对比';
            diffBtn.addEventListener('click', async () => {
                const currentContent = await this.app.vault.read(this.file);
                new DiffModal(this.app, version, {
                    name: '当前文档',
                    timestamp: Date.now(),
                    content: currentContent,
                    isCurrent: true
                }).open();
            });

            const restoreBtn = buttonsEl.createEl('button', { text: '↩️', cls: 'version-item-btn' });
            restoreBtn.title = '恢复';
            restoreBtn.addEventListener('click', async () => {
                if (confirm(`确定要恢复到版本 "${version.name}" 吗？`)) {
                    await this.plugin.versionService.restoreVersion(version, this.file);
                }
            });

            const deleteBtn = buttonsEl.createEl('button', { text: '🗑️', cls: 'version-item-btn' });
            deleteBtn.title = '删除';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`确定要删除版本 "${version.name}" 吗？`)) {
                    await this.plugin.versionService.deleteVersion(this.file, version.id);
                    await this.loadVersions();
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
                        new obsidian.Notice('最多只能选择 2 个版本进行对比');
                        return;
                    }
                    this.selectedVersions.push(version);
                } else {
                    this.selectedVersions = this.selectedVersions.filter(v => v.timestamp !== version.timestamp);
                }
                this.updateCompareBtn();
            });
        }

        this.updateCompareBtn();
    }

    updateCompareBtn() {
        if (this.selectedVersions.length === 2) {
            this.compareBtn.style.display = '';
            this.compareBtn.textContent = `🔍 对比: ${this.selectedVersions[0].name} vs ${this.selectedVersions[1].name}`;
        } else {
            this.compareBtn.style.display = 'none';
        }
    }

    compareSelected() {
        if (this.selectedVersions.length === 2) {
            new DiffModal(this.app, this.selectedVersions[0], this.selectedVersions[1]).open();
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
        contentEl.createEl('h2', {text: '编辑版本'});

        contentEl.createEl('label', {text: '版本名称'});
        const nameInput = contentEl.createEl('input', {
            type: 'text', value: this.version.name,
            cls: 'modal-input'
        });

        contentEl.createEl('label', {text: '版本描述'});
        const descInput = contentEl.createEl('textarea', { cls: 'modal-textarea' });
        descInput.value = this.version.description || '';

        const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        const cancelBtn = btnContainer.createEl('button', { text: '取消', cls: 'modal-cancel-btn' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = btnContainer.createEl('button', { text: '保存', cls: 'modal-save-btn' });
        saveBtn.addEventListener('click', async () => {
            const newName = nameInput.value.trim();
            if (!newName) {
                new obsidian.Notice('版本名称不能为空');
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

// ========== 差异对比模态框 ==========
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

class DiffModal extends obsidian.Modal {
    constructor(app, version1, version2) {
        super(app);
        this.version1 = version1;
        this.version2 = version2;
        this.showOnlyDiff = true;
        this.isFullscreen = true;
        this.viewMode = 'split';
    }

    async onOpen() {
        const {contentEl, modalEl} = this;
        contentEl.empty();

        this.modalEl = modalEl;
        this.diff = computeDiff(this.version1.content, this.version2.content);
        this.groups = this.groupDiffLines(this.diff);
        this.processedLines = this.processGroups(this.groups);

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
        const {contentEl, modalEl} = this;
        contentEl.empty();

        if (this.isFullscreen) {
            modalEl.style.position = 'fixed';
            modalEl.style.top = '0';
            modalEl.style.left = '0';
            modalEl.style.right = '0';
            modalEl.style.bottom = '0';
            modalEl.style.zIndex = '1000';
            modalEl.style.backgroundColor = 'var(--background-primary)';
            modalEl.style.margin = '0';
            contentEl.style.padding = '20px';
            contentEl.style.overflow = 'auto';
        } else {
            modalEl.style.position = '';
            modalEl.style.top = '';
            modalEl.style.left = '';
            modalEl.style.right = '';
            modalEl.style.bottom = '';
            modalEl.style.zIndex = '';
            modalEl.style.backgroundColor = '';
            modalEl.style.margin = '';
            contentEl.style.padding = '';
            contentEl.style.overflow = '';
        }

        const headerEl = contentEl.createDiv({ cls: 'diff-header' });
        headerEl.createEl('h2', { text: `版本对比: ${this.version1.name} vs ${this.version2.name}` });

        const controlsEl = headerEl.createDiv({ cls: 'diff-controls' });

        const diffToggleLabel = controlsEl.createEl('label', { cls: 'diff-toggle-label' });
        const diffToggle = diffToggleLabel.createEl('input', { type: 'checkbox' });
        diffToggle.checked = this.showOnlyDiff;
        diffToggle.addEventListener('change', () => {
            this.showOnlyDiff = diffToggle.checked;
            this.renderContent();
        });
        diffToggleLabel.createSpan({ text: '只显示差异' });

        const viewBtn = controlsEl.createEl('button', {
            cls: 'diff-view-btn',
            text: this.viewMode === 'split' ? '统一视图' : '拆分视图'
        });
        viewBtn.addEventListener('click', () => {
            this.viewMode = this.viewMode === 'split' ? 'unified' : 'split';
            this.renderContent();
        });

        const fullscreenBtn = controlsEl.createEl('button', { cls: 'diff-view-btn', text: this.isFullscreen ? '退出全屏' : '全屏' });
        fullscreenBtn.addEventListener('click', () => {
            this.isFullscreen = !this.isFullscreen;
            this.renderContent();
        });

        const closeBtn = controlsEl.createEl('button', { cls: 'diff-close-btn', text: '✕' });
        closeBtn.addEventListener('click', () => this.close());

        const container = contentEl.createDiv({ cls: 'diff-container' });

        const filtered = this.showOnlyDiff
            ? this.processedLines.filter(l => l.type !== 'equal')
            : this.processedLines;

        if (filtered.length === 0) {
            container.createDiv({ cls: 'diff-empty', text: '两个版本完全相同' });
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
        headerRow.createDiv({ cls: 'diff-cell-line-num', text: '行号' });
        headerRow.createDiv({ cls: 'diff-cell-content', text: this.version1.name });
        headerRow.createDiv({ cls: 'diff-cell-line-num', text: '行号' });
        headerRow.createDiv({ cls: 'diff-cell-content', text: this.version2.name });

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
        const {contentEl} = this;
        contentEl.empty();
    }
}

module.exports = VersionViewPlugin;
