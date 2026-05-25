const obsidian = require('obsidian');

// ========== 简易 Diff 算法 (基于 LCS) ==========
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
    
    const result = [];
    let i = m, j = n;
    const temp = [];
    
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
        return { nextId: 1, versions: [] };
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

        this.addRibbonIcon('clock', '版本视图', () => {
            this.showVersionView();
        });

        this.addCommand({
            id: 'toggle-version-view',
            name: '切换版本视图',
            callback: () => {
                this.showVersionView();
            }
        });

        this.addSettingTab(new VersionViewSettingTab(this.app, this));
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

    async showVersionView() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new obsidian.Notice('请先打开一个笔记');
            return;
        }

        const modal = new VersionViewModal(this.app, activeFile, {
            load: () => this.versionService.getVersions(activeFile),
            save: async (name) => {
                const content = await this.app.vault.read(activeFile);
                return this.versionService.saveVersion(activeFile, content, name, '');
            },
            update: (version, name, desc) => this.versionService.updateVersion(activeFile, version.id, name, desc),
            restore: (version) => this.versionService.restoreVersion(version, activeFile),
            delete: (version) => this.versionService.deleteVersion(activeFile, version.id)
        });
        modal.open();
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

// ========== 版本视图模态框 ==========
class VersionViewModal extends obsidian.Modal {
    constructor(app, file, callbacks) {
        super(app);
        this.file = file;
        this.callbacks = callbacks;
        this.versions = [];
        this.selectedVersions = [];
    }

    async onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.addClass('version-view-modal');

        const titleEl = contentEl.createEl('h2', {text: `版本视图: ${this.file.name}`});
        titleEl.style.marginBottom = '12px';

        const inputContainer = contentEl.createDiv();
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '10px';
        inputContainer.style.marginBottom = '16px';

        const nameInput = inputContainer.createEl('input', {
            type: 'text',
            attr: {placeholder: '版本名称（可选）'}
        });
        nameInput.style.flex = '1';
        nameInput.style.padding = '8px';
        nameInput.style.borderRadius = '4px';
        nameInput.style.border = '1px solid var(--background-modifier-border)';
        nameInput.style.backgroundColor = 'var(--background-modifier-form-field)';

        const saveBtn = inputContainer.createEl('button', {
            text: '保存此版本'
        });
        saveBtn.style.padding = '8px 16px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.borderRadius = '4px';
        saveBtn.style.backgroundColor = 'var(--interactive-accent)';
        saveBtn.style.color = 'var(--text-on-accent)';
        saveBtn.style.border = 'none';

        saveBtn.addEventListener('click', async () => {
            try {
                const name = nameInput.value.trim() || `V${this.versions.length + 1}`;
                const success = await this.callbacks.save(name);
                if (success) {
                    await this.loadVersions();
                    nameInput.value = '';
                }
            } catch (error) {
                new obsidian.Notice(`保存失败: ${error.message}`);
            }
        });

        const compareSelectedBtn = contentEl.createEl('button', {
            text: '🔍 对比选中版本'
        });
        compareSelectedBtn.style.display = 'none';
        compareSelectedBtn.style.width = '100%';
        compareSelectedBtn.style.padding = '8px';
        compareSelectedBtn.style.marginBottom = '16px';
        compareSelectedBtn.style.cursor = 'pointer';
        compareSelectedBtn.style.borderRadius = '4px';
        compareSelectedBtn.style.border = '1px solid var(--background-modifier-border)';
        compareSelectedBtn.style.backgroundColor = 'var(--background-secondary)';

        compareSelectedBtn.addEventListener('click', () => {
            if (this.selectedVersions.length === 2) {
                const [v1, v2] = this.selectedVersions;
                const diffModal = new DiffModal(this.app, v1, v2);
                diffModal.open();
            }
        });

        this.compareSelectedBtn = compareSelectedBtn;
        contentEl.appendChild(compareSelectedBtn);

        this.versionListEl = contentEl.createDiv();
        this.versionListEl.style.marginTop = '10px';
        this.versionListEl.style.maxHeight = '60vh';
        this.versionListEl.style.overflowY = 'auto';

        await this.loadVersions();
    }

    async loadVersions() {
        this.versionListEl.empty();
        this.versions = await this.callbacks.load();
        this.selectedVersions = [];
        this.checkboxes = [];
        this.compareSelectedBtn.style.display = 'none';

        if (this.versions.length === 0) {
            this.versionListEl.createEl('p', {text: '暂无版本'});
            return;
        }

        for (const version of this.versions) {
            const itemEl = this.versionListEl.createDiv();
            itemEl.style.padding = '12px';
            itemEl.style.borderBottom = '1px solid var(--background-modifier-border)';
            itemEl.style.display = 'flex';
            itemEl.style.justifyContent = 'space-between';
            itemEl.style.alignItems = 'center';

            const leftEl = itemEl.createDiv();
            leftEl.style.display = 'flex';
            leftEl.style.alignItems = 'center';
            leftEl.style.gap = '10px';
            leftEl.style.flex = '1';
            leftEl.style.minWidth = '0';

            const checkbox = leftEl.createEl('input', {type: 'checkbox'});
            checkbox.style.width = '18px';
            checkbox.style.height = '18px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.flexShrink = '0';

            const infoEl = leftEl.createDiv();
            infoEl.style.minWidth = '0';
            const dateStr = new Date(version.timestamp).toLocaleString();
            infoEl.createEl('div', {text: version.name, cls: 'version-view-name'});
            if (version.description) {
                const descEl = infoEl.createEl('div', {text: version.description, cls: 'version-view-description'});
                descEl.title = version.description;
            }
            infoEl.createEl('small', {text: dateStr, style: 'color: var(--text-muted);'});

            const buttonsEl = itemEl.createDiv();
            buttonsEl.style.display = 'flex';
            buttonsEl.style.gap = '6px';
            buttonsEl.style.flexShrink = '0';

            const editBtn = buttonsEl.createEl('button', {text: '✏️'});
            editBtn.style.padding = '4px 6px';
            editBtn.style.cursor = 'pointer';
            editBtn.style.borderRadius = '4px';
            editBtn.style.border = '1px solid var(--background-modifier-border)';
            editBtn.style.backgroundColor = 'var(--background-secondary)';
            editBtn.title = '编辑';
            editBtn.addEventListener('click', () => {
                new EditVersionModal(this.app, version, {
                    update: (v, name, desc) => this.callbacks.update(v, name, desc),
                    onDone: () => this.loadVersions()
                }).open();
            });

            const diffCurrentBtn = buttonsEl.createEl('button', {text: '🔍'});
            diffCurrentBtn.style.padding = '4px 6px';
            diffCurrentBtn.style.cursor = 'pointer';
            diffCurrentBtn.style.borderRadius = '4px';
            diffCurrentBtn.style.border = '1px solid var(--background-modifier-border)';
            diffCurrentBtn.style.backgroundColor = 'var(--background-secondary)';
            diffCurrentBtn.title = '与当前对比';
            diffCurrentBtn.addEventListener('click', async () => {
                const currentContent = await this.app.vault.read(this.file);
                const currentVersion = {
                    name: '当前文档',
                    timestamp: Date.now(),
                    content: currentContent,
                    isCurrent: true
                };
                const diffModal = new DiffModal(this.app, version, currentVersion);
                diffModal.open();
            });

            const restoreBtn = buttonsEl.createEl('button', {text: '↩️'});
            restoreBtn.style.padding = '4px 6px';
            restoreBtn.style.cursor = 'pointer';
            restoreBtn.style.borderRadius = '4px';
            restoreBtn.style.border = '1px solid var(--background-modifier-border)';
            restoreBtn.style.backgroundColor = 'var(--background-secondary)';
            restoreBtn.title = '恢复';
            restoreBtn.addEventListener('click', async () => {
                if (confirm(`确定要恢复到版本 "${version.name}" 吗？`)) {
                    await this.callbacks.restore(version);
                    this.close();
                }
            });

            const deleteBtn = buttonsEl.createEl('button', {text: '🗑️'});
            deleteBtn.style.padding = '4px 6px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.borderRadius = '4px';
            deleteBtn.style.border = '1px solid var(--background-modifier-border)';
            deleteBtn.style.backgroundColor = 'var(--background-secondary)';
            deleteBtn.title = '删除';
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`确定要删除版本 "${version.name}" 吗？`)) {
                    await this.callbacks.delete(version);
                    await this.loadVersions();
                }
            });

            this.checkboxes.push({ el: checkbox, version: version });

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

                this.updateCompareButton();
                this.updateCheckboxStates();
            });
        }

        this.updateCheckboxStates();
    }

    updateCheckboxStates() {
        const isFull = this.selectedVersions.length >= 2;
        for (const item of this.checkboxes) {
            if (item.el.checked) {
                item.el.disabled = false;
                item.el.style.opacity = '1';
            } else {
                item.el.disabled = isFull;
                item.el.style.opacity = isFull ? '0.4' : '1';
            }
        }
    }

    updateCompareButton() {
        if (this.selectedVersions.length === 2) {
            this.compareSelectedBtn.style.display = 'block';
            this.compareSelectedBtn.textContent = `🔍 对比: ${this.selectedVersions[0].name} vs ${this.selectedVersions[1].name}`;
        } else {
            this.compareSelectedBtn.style.display = 'none';
        }
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
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

        const nameContainer = contentEl.createDiv();
        nameContainer.style.marginBottom = '16px';
        nameContainer.createEl('label', {text: '版本名称'});
        nameContainer.style.display = 'block';

        const nameInput = contentEl.createEl('input', {
            type: 'text',
            value: this.version.name
        });
        nameInput.style.width = '100%';
        nameInput.style.padding = '8px';
        nameInput.style.marginBottom = '16px';
        nameInput.style.borderRadius = '4px';
        nameInput.style.border = '1px solid var(--background-modifier-border)';
        nameInput.style.backgroundColor = 'var(--background-modifier-form-field)';

        const descContainer = contentEl.createDiv();
        descContainer.style.marginBottom = '16px';
        descContainer.createEl('label', {text: '版本描述'});
        descContainer.style.display = 'block';

        const descInput = contentEl.createEl('textarea');
        descInput.value = this.version.description || '';
        descInput.style.width = '100%';
        descInput.style.height = '100px';
        descInput.style.padding = '8px';
        descInput.style.marginBottom = '16px';
        descInput.style.borderRadius = '4px';
        descInput.style.border = '1px solid var(--background-modifier-border)';
        descInput.style.backgroundColor = 'var(--background-modifier-form-field)';
        descInput.style.resize = 'vertical';

        const btnContainer = contentEl.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.justifyContent = 'flex-end';

        const cancelBtn = btnContainer.createEl('button', {text: '取消'});
        cancelBtn.style.padding = '8px 16px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.borderRadius = '4px';
        cancelBtn.style.border = '1px solid var(--background-modifier-border)';
        cancelBtn.style.backgroundColor = 'var(--background-secondary)';
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = btnContainer.createEl('button', {text: '保存'});
        saveBtn.style.padding = '8px 16px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.borderRadius = '4px';
        saveBtn.style.border = 'none';
        saveBtn.style.backgroundColor = 'var(--interactive-accent)';
        saveBtn.style.color = 'var(--text-on-accent)';
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
        this.isFullscreen = false;
    }

    async onOpen() {
        const {contentEl} = this;
        contentEl.empty();

        this.diff = computeDiff(this.version1.content, this.version2.content);
        this.groups = this.groupDiffLines(this.diff);

        this.renderContent();
    }

    renderContent() {
        const {contentEl} = this;
        contentEl.empty();

        if (this.isFullscreen) {
            contentEl.style.position = 'fixed';
            contentEl.style.top = '0';
            contentEl.style.left = '0';
            contentEl.style.right = '0';
            contentEl.style.bottom = '0';
            contentEl.style.zIndex = '1000';
            contentEl.style.backgroundColor = 'var(--background-primary)';
            contentEl.style.padding = '20px';
            contentEl.style.overflow = 'auto';
        } else {
            contentEl.style.position = '';
            contentEl.style.top = '';
            contentEl.style.left = '';
            contentEl.style.right = '';
            contentEl.style.bottom = '';
            contentEl.style.zIndex = '';
            contentEl.style.backgroundColor = '';
            contentEl.style.padding = '';
            contentEl.style.overflow = '';
        }

        const headerEl = contentEl.createDiv();
        headerEl.style.display = 'flex';
        headerEl.style.justifyContent = 'space-between';
        headerEl.style.alignItems = 'center';
        headerEl.style.marginBottom = '16px';

        headerEl.createEl('h2', {text: `版本对比: ${this.version1.name} vs ${this.version2.name}`});

        const controlsEl = headerEl.createDiv();
        controlsEl.style.display = 'flex';
        controlsEl.style.gap = '10px';
        controlsEl.style.alignItems = 'center';

        const diffToggleLabel = controlsEl.createEl('label');
        diffToggleLabel.style.display = 'flex';
        diffToggleLabel.style.alignItems = 'center';
        diffToggleLabel.style.gap = '6px';
        diffToggleLabel.style.cursor = 'pointer';
        diffToggleLabel.style.fontSize = '13px';

        const diffToggle = diffToggleLabel.createEl('input', {type: 'checkbox'});
        diffToggle.checked = this.showOnlyDiff;
        diffToggle.addEventListener('change', () => {
            this.showOnlyDiff = diffToggle.checked;
            this.renderContent();
        });

        diffToggleLabel.appendChild(document.createTextNode('只显示差异'));
        controlsEl.appendChild(diffToggleLabel);

        const fullscreenBtn = controlsEl.createEl('button', {
            text: this.isFullscreen ? '退出全屏' : '全屏'
        });
        fullscreenBtn.style.padding = '4px 12px';
        fullscreenBtn.style.cursor = 'pointer';
        fullscreenBtn.style.borderRadius = '4px';
        fullscreenBtn.style.border = '1px solid var(--background-modifier-border)';
        fullscreenBtn.style.backgroundColor = 'var(--background-secondary)';
        fullscreenBtn.addEventListener('click', () => {
            this.isFullscreen = !this.isFullscreen;
            this.renderContent();
        });
        controlsEl.appendChild(fullscreenBtn);

        const closeBtn = controlsEl.createEl('button', {text: '✕'});
        closeBtn.style.padding = '4px 10px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.border = '1px solid var(--background-modifier-border)';
        closeBtn.style.backgroundColor = 'var(--background-secondary)';
        closeBtn.addEventListener('click', () => this.close());
        controlsEl.appendChild(closeBtn);

        const diffContainer = contentEl.createDiv();
        diffContainer.style.borderRadius = '8px';
        diffContainer.style.border = '1px solid var(--background-modifier-border)';
        diffContainer.style.overflow = 'hidden';

        const headerRow = diffContainer.createDiv();
        headerRow.style.display = 'flex';
        headerRow.style.backgroundColor = 'var(--background-secondary)';
        headerRow.style.borderBottom = '1px solid var(--background-modifier-border)';
        headerRow.style.fontWeight = '600';
        headerRow.style.fontSize = '12px';
        headerRow.style.color = 'var(--text-muted)';

        const lineNumHeader1 = headerRow.createDiv();
        lineNumHeader1.style.width = '50px';
        lineNumHeader1.style.padding = '8px';
        lineNumHeader1.style.textAlign = 'center';
        lineNumHeader1.textContent = '行号';

        const oldHeader = headerRow.createDiv();
        oldHeader.style.flex = '1';
        oldHeader.style.padding = '8px 12px';
        oldHeader.textContent = this.version1.name;

        const lineNumHeader2 = headerRow.createDiv();
        lineNumHeader2.style.width = '50px';
        lineNumHeader2.style.padding = '8px';
        lineNumHeader2.style.textAlign = 'center';
        lineNumHeader2.textContent = '行号';

        const newHeader = headerRow.createDiv();
        newHeader.style.flex = '1';
        newHeader.style.padding = '8px 12px';
        newHeader.textContent = this.version2.name;

        const contentContainer = diffContainer.createDiv();
        contentContainer.style.maxHeight = this.isFullscreen ? 'calc(100vh - 200px)' : '65vh';
        contentContainer.style.overflowY = 'auto';

        const filteredGroups = this.showOnlyDiff
            ? this.groups.filter(g => g.type !== 'equal')
            : this.groups;

        if (filteredGroups.length === 0) {
            contentContainer.createDiv({
                text: '两个版本完全相同',
                style: 'text-align: center; padding: 40px; color: var(--text-muted);'
            });
            return;
        }

        let oldLineNum = 1;
        let newLineNum = 1;

        if (this.showOnlyDiff) {
            for (const g of this.groups) {
                if (g.type !== 'equal') break;
                const lines = g.value.split('\n');
                oldLineNum += lines.length;
                newLineNum += lines.length;
            }
        }

        const oldFm = new FrontmatterTracker();
        const newFm = new FrontmatterTracker();

        for (const group of filteredGroups) {
            const lines = group.value.split('\n');

            for (const line of lines) {
                const row = contentContainer.createDiv();
                row.style.display = 'flex';
                row.style.borderBottom = '1px solid var(--background-modifier-border)';
                row.style.fontSize = '13px';
                row.style.fontFamily = 'var(--font-monospace, monospace)';

                if (group.type === 'equal') {
                    const isFm = oldFm.next(line);
                    newFm.next(line);
                    if (isFm) row.addClass('version-diff-frontmatter');

                    row.style.backgroundColor = 'transparent';

                    const oldNumCell = row.createDiv();
                    oldNumCell.style.width = '50px';
                    oldNumCell.style.padding = '4px';
                    oldNumCell.style.textAlign = 'center';
                    oldNumCell.style.color = 'var(--text-muted)';
                    oldNumCell.style.userSelect = 'none';
                    oldNumCell.textContent = oldLineNum;
                    oldLineNum++;

                    const oldCell = row.createDiv();
                    oldCell.style.flex = '1';
                    oldCell.style.padding = '4px 12px';
                    oldCell.style.whiteSpace = 'pre-wrap';
                    oldCell.style.wordBreak = 'break-all';
                    oldCell.style.userSelect = 'text';
                    oldCell.textContent = line;

                    const newNumCell = row.createDiv();
                    newNumCell.style.width = '50px';
                    newNumCell.style.padding = '4px';
                    newNumCell.style.textAlign = 'center';
                    newNumCell.style.color = 'var(--text-muted)';
                    newNumCell.style.userSelect = 'none';
                    newNumCell.textContent = newLineNum;
                    newLineNum++;

                    const newCell = row.createDiv();
                    newCell.style.flex = '1';
                    newCell.style.padding = '4px 12px';
                    newCell.style.whiteSpace = 'pre-wrap';
                    newCell.style.wordBreak = 'break-all';
                    newCell.style.userSelect = 'text';
                    newCell.textContent = line;

                } else if (group.type === 'removed') {
                    const isFm = oldFm.next(line);
                    if (isFm) row.addClass('version-diff-frontmatter');

                    row.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';

                    const oldNumCell = row.createDiv();
                    oldNumCell.style.width = '50px';
                    oldNumCell.style.padding = '4px';
                    oldNumCell.style.textAlign = 'center';
                    oldNumCell.style.color = '#ef4444';
                    oldNumCell.style.userSelect = 'none';
                    oldNumCell.textContent = oldLineNum;
                    oldLineNum++;

                    const oldCell = row.createDiv();
                    oldCell.style.flex = '1';
                    oldCell.style.padding = '4px 12px';
                    oldCell.style.whiteSpace = 'pre-wrap';
                    oldCell.style.wordBreak = 'break-all';
                    oldCell.style.color = '#ef4444';
                    oldCell.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                    oldCell.style.userSelect = 'text';
                    oldCell.textContent = line;

                    const newNumCell = row.createDiv();
                    newNumCell.style.width = '50px';
                    newNumCell.style.padding = '4px';
                    newNumCell.style.textAlign = 'center';
                    newNumCell.style.color = 'var(--text-muted)';
                    newNumCell.style.userSelect = 'none';
                    newNumCell.textContent = '';

                    const newCell = row.createDiv();
                    newCell.style.flex = '1';
                    newCell.style.padding = '4px 12px';
                    newCell.style.whiteSpace = 'pre-wrap';
                    newCell.style.wordBreak = 'break-all';
                    newCell.style.userSelect = 'text';
                    newCell.textContent = '';

                } else if (group.type === 'added') {
                    const isFm = newFm.next(line);
                    if (isFm) row.addClass('version-diff-frontmatter');

                    row.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';

                    const oldNumCell = row.createDiv();
                    oldNumCell.style.width = '50px';
                    oldNumCell.style.padding = '4px';
                    oldNumCell.style.textAlign = 'center';
                    oldNumCell.style.color = 'var(--text-muted)';
                    oldNumCell.style.userSelect = 'none';
                    oldNumCell.textContent = '';

                    const oldCell = row.createDiv();
                    oldCell.style.flex = '1';
                    oldCell.style.padding = '4px 12px';
                    oldCell.style.whiteSpace = 'pre-wrap';
                    oldCell.style.wordBreak = 'break-all';
                    oldCell.style.userSelect = 'text';
                    oldCell.textContent = '';

                    const newNumCell = row.createDiv();
                    newNumCell.style.width = '50px';
                    newNumCell.style.padding = '4px';
                    newNumCell.style.textAlign = 'center';
                    newNumCell.style.color = '#22c55e';
                    newNumCell.style.userSelect = 'none';
                    newNumCell.textContent = newLineNum;
                    newLineNum++;

                    const newCell = row.createDiv();
                    newCell.style.flex = '1';
                    newCell.style.padding = '4px 12px';
                    newCell.style.whiteSpace = 'pre-wrap';
                    newCell.style.wordBreak = 'break-all';
                    newCell.style.color = '#22c55e';
                    newCell.style.backgroundColor = 'rgba(34, 197, 94, 0.05)';
                    newCell.style.userSelect = 'text';
                    newCell.textContent = line;
                }
            }
        }
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

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

module.exports = VersionViewPlugin;
