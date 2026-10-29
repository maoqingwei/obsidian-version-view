const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

class Element {
    constructor() { this.children = []; this.style = {}; this.listeners = {}; }
    createEl(tag, options = {}) {
        const child = new Element();
        Object.assign(child, options, { tag });
        this.children.push(child);
        return child;
    }
    createDiv(options) { return this.createEl('div', options); }
    createSpan(options) { return this.createEl('span', options); }
    addClass() {}
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    empty() { this.children = []; }
    setText(text) { this.text = text; }
    all() { return [this, ...this.children.flatMap(child => child.all())]; }
}

function load(language, { legacy = false, unavailable = false } = {}) {
    const notices = [];
    const errors = [];
    const obsidian = {
        Plugin: class {}, PluginSettingTab: class {}, Modal: class {},
        ItemView: class { constructor() { this.contentEl = new Element(); } },
        Notice: class { constructor(message) { notices.push(message); } }
    };
    if (!legacy) obsidian.getLanguage = () => {
        if (unavailable) throw new Error('Language unavailable');
        return language;
    };
    const context = vm.createContext({
        require: name => { assert.equal(name, 'obsidian'); return obsidian; },
        module: { exports: {} }, console: { ...console, error: (...args) => errors.push(args) },
        localStorage: { getItem: key => { assert.equal(key, 'language'); return language; } }
    });
    vm.runInContext(source + '\n;globalThis.subject = { t, VersionService, VersionViewPane, DiffViewPane };', context);
    return { ...context.subject, Plugin: context.module.exports, notices, errors };
}

for (const language of ['zh', 'zh-CN', 'zh-TW', 'zh_HK', 'en', 'de', null]) {
    test(`ribbon, command, sidebar and diff labels: ${language}`, async () => {
        const { Plugin, VersionViewPane, DiffViewPane } = load(language);
        const chinese = /^zh/.test(language || '');
        const plugin = new Plugin();
        plugin.loadData = async () => ({});
        plugin.registerView = () => {};
        plugin.addRibbonIcon = (icon, title) => assert.equal(title, chinese ? '版本视图' : 'Version View');
        plugin.addCommand = command => {
            assert.equal(command.id, 'toggle-version-view');
            assert.equal(command.name, chinese ? '切换版本视图' : 'Toggle Version View');
        };
        plugin.addSettingTab = () => {};
        await plugin.onload();
        const pane = new VersionViewPane({}, plugin);
        pane.buildUI();
        const labels = pane.contentEl.all().map(element => element.text);
        assert.ok(labels.includes(chinese ? '保存版本' : 'Save version'));
        assert.equal(pane.nameInput.attr.placeholder, chinese ? '版本名称（可选）' : 'Version Name (Optional)');
        const diff = new DiffViewPane({}, plugin);
        diff.version1 = { name: '中文 {value1} $&' };
        diff.version2 = { name: 'English' };
        assert.equal(diff.getDisplayText(), `${chinese ? '对比' : 'Compare'}: 中文 {value1} $& → English`);
        const container = new Element();
        diff.renderSplitView(container, []);
        assert.equal(container.all().filter(el => el.text === (chinese ? '行号' : 'Line')).length, 2);
    });
}

for (const language of ['zh', 'en']) {
    test(`version operations preserve user data and translate notices: ${language}`, async () => {
        const { VersionService, notices } = load(language);
        const data = new Map();
        let restored;
        const vault = {
            adapter: { list: async () => ({ files: [] }), exists: async p => data.has(p), read: async p => data.get(p), write: async (p, value) => data.set(p, value) },
            createFolder: async p => data.set(p, ''),
            read: async () => content,
            modify: async (file, value) => { restored = value; }
        };
        const service = new VersionService({ vault }, { versionFolder: '.res/versions' });
        const file = { path: '笔记.md' };
        const name = '中文 "draft" {value0} $&';
        const content = '正文\nEnglish\n{value0}';
        assert.equal(await service.saveVersion(file, content, name, '描述'), true);
        let versions = await service.getVersions(file);
        assert.equal(versions[0].name, name);
        assert.equal(versions[0].content, content);
        assert.equal(notices.at(-1), language === 'zh' ? `版本 "${name}" 已保存` : `Version "${name}" saved`);
        assert.equal(await service.updateVersion(file, versions[0].id, name, '新描述'), true);
        versions = await service.getVersions(file);
        assert.equal(versions[0].description, '新描述');
        assert.equal(await service.restoreVersion({ ...versions[0], content: '旧内容' }, file), true);
        assert.equal(restored, '旧内容');
        assert.equal(await service.deleteVersion(file, versions[0].id), true);
        assert.equal((await service.getVersions(file)).length, 1);
        assert.equal(notices.at(-1), language === 'zh' ? '版本已删除' : 'Version deleted');
        assert.equal(await service.updateVersion(file, 999, name, ''), false);
        assert.equal(notices.at(-1), language === 'zh' ? '版本不存在' : 'Version not found');
    });
}

test('older Obsidian uses stored language; unavailable API falls back to English', () => {
    assert.equal(load('zh', { legacy: true }).t('保存'), '保存');
    assert.equal(load(null, { legacy: true }).t('保存'), 'Save');
    assert.equal(load('zh', { unavailable: true }).t('保存'), 'Save');
});

function deferred() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
}

function vaultFixture(content = 'unsaved work') {
    const data = new Map();
    const file = { path: 'note.md', name: 'note.md', basename: 'note' };
    const state = { content, modifications: 0 };
    const vault = {
        adapter: {
            exists: async p => data.has(p), list: async () => ({ files: [] }),
            read: async p => data.get(p), write: async (p, text) => data.set(p, text)
        },
        createFolder: async p => data.set(p, ''),
        read: async target => { assert.equal(target, file); return state.content; },
        modify: async (target, text) => { assert.equal(target, file); state.modifications++; state.content = text; }
    };
    return { data, file, state, vault };
}

for (const language of ['zh', 'en']) {
    test(`restore persists a backup before replacement and supports safe undo: ${language}`, async () => {
        const { VersionService, notices } = load(language);
        const { vault, file, state, data } = vaultFixture();
        const service = new VersionService({ vault }, { versionFolder: '.res/versions' });
        const modify = vault.modify;
        vault.modify = async (...args) => {
            const index = JSON.parse(data.get(service._getIndexPath(file)));
            assert.equal(index.versions[0].content, 'unsaved work');
            return modify(...args);
        };
        assert.equal(await service.restoreVersion({ content: 'old snapshot' }, file), true);
        assert.equal(state.content, 'old snapshot');
        assert.equal(service.canUndoRestore(file), true);
        const backup = (await service.getVersions(file))[0];
        assert.match(backup.name, language === 'zh' ? /^恢复前备份/ : /^Before restore/);
        assert.equal(await service.undoRestore(file), true);
        assert.equal(state.content, 'unsaved work');
        assert.equal(service.canUndoRestore(file), false);
        assert.equal(notices.at(-1), language === 'zh' ? '已撤销恢复' : 'Restore undone');
        assert.equal((await service.getVersions(file))[0].content, 'unsaved work');
    });
}

test('backup failure prevents replacement; undo never overwrites subsequent edits', async () => {
    const { VersionService } = load('en');
    const { vault, file, state } = vaultFixture();
    const service = new VersionService({ vault }, { versionFolder: '.res/versions' });
    const write = vault.adapter.write;
    vault.adapter.write = async () => { throw new Error('disk full'); };
    assert.equal(await service.restoreVersion({ content: 'old' }, file), false);
    assert.equal(state.modifications, 0);
    assert.equal(service.canUndoRestore(file), false);
    vault.adapter.write = write;
    assert.equal(await service.restoreVersion({ content: 'old' }, file), true);
    state.content = 'new edits after restore';
    assert.equal(await service.undoRestore(file), false);
    assert.equal(state.content, 'new edits after restore');
    assert.equal((await service.getVersions(file))[0].content, 'unsaved work');
});

test('concurrent save and restore keep both snapshots', async () => {
    const { VersionService } = load('en');
    const { vault, file, state } = vaultFixture();
    const service = new VersionService({ vault }, { versionFolder: '.res/versions' });
    const results = await Promise.all([
        service.saveVersion(file, 'manual snapshot', 'draft', ''),
        service.restoreVersion({ content: 'old' }, file)
    ]);
    assert.ok(results.every(Boolean));
    const versions = await service.getVersions(file);
    assert.equal(versions.length, 2);
    assert.ok(versions.some(v => v.content === 'manual snapshot'));
    assert.ok(versions.some(v => v.content === 'unsaved work'));
    assert.equal(state.content, 'old');
});

test('save disables controls, ignores double click and resets after failure', async () => {
    const { VersionViewPane } = load('en');
    const gate = deferred();
    let writes = 0;
    const file = { path: 'a.md' };
    const pane = new VersionViewPane({}, { versionService: {
        saveVersion: async () => { writes++; return gate.promise; },
        canUndoRestore: () => false
    } });
    pane.buildUI();
    assert.equal(pane.saveBtn.disabled, true);
    pane.file = file;
    pane.nameInput.value = 'draft';
    pane.app = { vault: { read: async () => 'text' } };
    const saving = pane.saveCurrentVersion();
    assert.equal(pane.saveBtn.disabled, true);
    assert.equal(pane.saveBtn.text, 'Saving…');
    await pane.saveCurrentVersion();
    assert.equal(writes, 1);
    gate.resolve(false);
    await saving;
    assert.equal(pane.saveBtn.disabled, false);
    assert.equal(pane.saveBtn.text, 'Save version');
    assert.equal(pane.nameInput.value, 'draft');
});

test('switching notes during a save preserves the new note name and input', async () => {
    const { VersionViewPane } = load('en');
    const gate = deferred();
    const a = { path: 'folder/a.md', basename: 'a' }, b = { path: 'folder/b.md', basename: 'b' };
    let active = a;
    let savedFile;
    const pane = new VersionViewPane({}, { versionService: {
        saveVersion: async file => { savedFile = file; return gate.promise; },
        getVersions: async () => [], canUndoRestore: () => false
    } });
    pane.app = { workspace: { getActiveFile: () => active }, vault: { read: async () => 'A' } };
    pane.buildUI();
    await pane.refresh();
    pane.nameInput.value = 'A draft';
    const saving = pane.saveCurrentVersion();
    active = b;
    await pane.refresh();
    pane.nameInput.value = 'B draft';
    gate.resolve(true);
    await saving;
    assert.equal(savedFile, a);
    assert.equal(pane.fileLabel.text, 'b');
    assert.equal(pane.fileLabel.title, 'folder/b.md');
    assert.equal(pane.nameInput.value, 'B draft');
    assert.equal(pane.saveBtn.disabled, false);
});

test('late version loads cannot replace the active note list, including no-note state', async () => {
    const { VersionViewPane } = load('en');
    const gate = deferred();
    const a = { path: 'a.md', basename: 'a' }, b = { path: 'b.md', basename: 'b' };
    let active = a;
    const pane = new VersionViewPane({}, { versionService: {
        getVersions: file => file === a ? gate.promise : Promise.resolve([]),
        canUndoRestore: () => false
    } });
    pane.app = { workspace: { getActiveFile: () => active } };
    pane.buildUI();
    const first = pane.refresh();
    active = b;
    await pane.refresh();
    active = null;
    await pane.refresh();
    gate.resolve([{ id: 1, name: 'A version' }]);
    await first;
    assert.equal(pane.versions.length, 0);
    assert.equal(pane.fileLabel.text, 'No note selected');
    assert.equal(pane.saveBtn.disabled, true);
});

test('comparison always opens older on the left, including reversed selection and equal timestamps', async () => {
    const { Plugin } = load('en');
    const plugin = new Plugin();
    let state;
    plugin.app = { workspace: { getLeaf: () => ({ setViewState: async value => { state = value.state; } }) } };
    const older = { id: 1, timestamp: 10, name: 'old' };
    const newer = { id: 2, timestamp: 20, name: 'new' };
    await plugin.openDiffView(newer, older);
    assert.equal(state.version1, older);
    assert.equal(state.version2, newer);
    const sameTime = { ...newer, timestamp: 10 };
    await plugin.openDiffView(sameTime, older);
    assert.equal(state.version1, older);
    const live = { timestamp: 0, isCurrent: true };
    await plugin.openDiffView(live, newer);
    assert.equal(state.version2, live);
});
