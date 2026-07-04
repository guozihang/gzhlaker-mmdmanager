// Unified notification helper
window.showNotify = function (msg, type) {
    var titleMap = { success: '成功', error: '错误', warning: '提示', info: '消息' };
    var typeMap  = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
    var t = type || 'success';
    window.app.$notify({
        title: titleMap[t] || '消息',
        message: '<div style="text-align:center;font-size:14px">' + msg + '</div>',
        dangerouslyUseHTMLString: true,
        type: typeMap[t],
        duration: t === 'error' ? 3000 : 1500
    });
};

// Import progress state (reactive for Vue overlay)
window._importProgress = { visible: false, pct: 0, text: '', detail: '', total: 0, done: 0 };

window.updateImportProgress = function(opts) {
    var p = window._importProgress;
    if (opts.visible !== undefined) { p.visible = opts.visible; }
    if (opts.text !== undefined) { p.text = opts.text; }
    if (opts.detail !== undefined) { p.detail = opts.detail; }
    if (opts.total !== undefined) { p.total = opts.total; }
    if (opts.done !== undefined) {
        p.done = opts.done;
        p.pct = p.total > 0 ? Math.round(p.done / p.total * 100) : 0;
    }
    // Force Vue to detect changes on the plain object
    window._importProgress = p;
    if (window.app && window.app.$forceUpdate) window.app.$forceUpdate();
};

//Vue相关
Vue.config.productionTip = false;
router = new VueRouter({
    routes: routes,
});
// Listen for messages from preload (menu navigation + file drops)
window.addEventListener('message', function (event) {
    if (!event.data) return;
    if (event.data.type === 'file:drop') {
        handleDrop(event.data.path);
    } else if (event.data.type === 'file:batch-drop') {
        window.handleBatchDrop(event.data.paths, event.data.total);
    }
});

window.app = new Vue({
    el: "#app",
    store,
    router: router,
    computed: {
        importProgress: {
            get() { return window._importProgress || {}; },
        },
    },
    methods: {},
});
hulla = new hullabaloo();


function handleDrop(droppedPath) {
    collectAndProcess([droppedPath], function(files) {
        if (files.length > 0) showDropImportDialog(files);
    });
}

window.handleBatchDrop = function(paths, total) {
    collectAndProcess(paths, function(files) {
        if (files.length > 0) showDropImportDialog(files);
    });
};

function collectAndProcess(paths, callback) {
    // First pass: separate zips from regular files
    var zipFiles = [];
    var regularFiles = [];
    paths.forEach(function(p) {
        var ext = window.path.extname(p).toLowerCase();
        if (ext === '.zip') {
            zipFiles.push(p);
        } else {
            regularFiles = regularFiles.concat(collectDropFiles(p));
        }
    });
    if (zipFiles.length === 0) { callback(regularFiles); return; }
    // Extract zips async
    var extracted = [];
    var idx = 0;
    function nextZip() {
        if (idx >= zipFiles.length) {
            callback(regularFiles.concat(extracted));
            return;
        }
        var zp = zipFiles[idx];
        idx++;
        var tmpDir = zp.replace(/\.zip$/i, '') + '_extracted_' + Date.now();
        window.fs.mkdirSync(tmpDir, { recursive: true });
        window.extractZip(zp, tmpDir).then(function(res) {
            if (res && res.success) {
                var zfiles = collectDropFiles(tmpDir);
                // If extracted files are all at root (no subdirs), wrap in folder named after ZIP
                var hasDirs = false;
                try {
                    var tc = window.fs.readdirSync(tmpDir);
                    tc.forEach(function(c) {
                        try { var cs = window.fs.statSync(tmpDir + window.path.sep + c); if (cs && cs.isDirectory()) hasDirs = true; } catch(e) {}
                    });
                } catch(e) {}
                if (!hasDirs && zfiles.length > 0) {
                    var zipName = window.path.basename(zp).replace(/\.zip$/i, '');
                    zfiles.forEach(function(zf) { zf.relDir = zipName + (zf.relDir ? (window.path.sep + zf.relDir) : ''); });
                }
                extracted = extracted.concat(zfiles);
            }
            nextZip();
        }).catch(function() { nextZip(); });
    }
    nextZip();
}

function collectDropFiles(srcPath) {
    var files = [];
    try {
        var ext = window.path.extname(srcPath).toLowerCase();
        var stats = window.fs.statSync(srcPath);
        if (!stats.isDirectory) {
            var allowed = getMonitoredExtensions();
            if (allowed[ext]) {
                // Single file: wrap in its parent folder
                var parentName = window.path.basename(window.path.dirname(srcPath));
                files.push({
                    src: srcPath,
                    name: window.path.basename(srcPath),
                    relDir: parentName
                });
            }
        } else {
            // Dragged folder: preserve the folder name as relDir root
            var folderName = window.path.basename(srcPath);
            scanDropDir(srcPath + window.path.sep, files, srcPath, folderName);
        }
    } catch(e) {}
    return files;
}

function getMonitoredExtensions() {
    var cats = (window.app && window.app.settings && window.app.settings.categories) || [
        { name: '人物模型', extensions: '.pmx,.pmd' },
        { name: '场景模型', extensions: '.pmx,.x' },
        { name: '动作文件', extensions: '.vmd' },
        { name: 'MME特效', extensions: '.fx,.x' }
    ];
    var map = {};
    cats.forEach(function(c) {
        (c.extensions || '').split(',').forEach(function(e) {
            e = e.trim().toLowerCase();
            if (e) map[e] = true;
        });
    });
    return map;
}

function scanDropDir(dir, files, rootPath, wrapFolder) {
    if (!rootPath) rootPath = dir;
    var rp = rootPath.replace(/[/\\]+$/, '');
    var list;
    try { list = window.fs.readdirSync(dir); } catch(e) { return; }
    var allowed = getMonitoredExtensions();
    for (var i = 0; i < list.length; i++) {
        var full = dir + list[i];
        var st;
        try { st = window.fs.statSync(full); } catch(e) { continue; }
        if (st.isDirectory) { scanDropDir(full + window.path.sep, files, rootPath); }
        else {
            var ext = window.path.extname(list[i]).toLowerCase();
            if (allowed[ext]) {
                var parentNorm = window.path.dirname(full).replace(/[/\\]+$/, '');
                var relDir = '';
                if (parentNorm !== rp && parentNorm.length > rp.length) {
                    relDir = parentNorm.slice(rp.length + 1);
                }
                if (!relDir && wrapFolder) relDir = wrapFolder;
                files.push({ src: full, name: list[i], relDir: relDir });
            }
        }
    }
}

function showDropImportDialog(files) {
    var settings = (window.store && window.store.state && window.store.state.settings) || {};
    var dataPaths = (settings.dataPaths || []).filter(function(p) { return p.path && p.path.length > 0; });
    if (dataPaths.length === 0) {
        window.showNotify('请先在设置中添加数据存储路径', 'warning');
        return;
    }

    var settingsRef = (window.store && window.store.state && window.store.state.settings) || {};
var cats = settingsRef.categories || [];
    var tags = settingsRef.tags || [];

    var el = document.createElement('div');
    document.body.appendChild(el);
    var selectedPaths = {};
    var choices = {};
    var tagChoices = {};
    // Group by source folder
    var folders = {}, folderList = [];
    files.forEach(function(f) {
        var key = f.relDir || window.path.basename(window.path.dirname(f.src));
        if (!folders[key]) { folders[key] = { name: key, models: [] }; folderList.push(folders[key]); }
        folders[key].models.push(f);
    });
    folderList.forEach(function(fd) {
        selectedPaths[fd.name] = dataPaths[0].path;
        choices[fd.name] = dataPaths[0].category || '人物模型';
        tagChoices[fd.name] = (dataPaths[0].tags || []).slice();
    });

    var vm = new Vue({
        el: el,
        data: {
            folders: folderList, dataPaths: dataPaths, selectedPaths: selectedPaths,
            choices: choices, tagChoices: tagChoices, categories: cats, tags: tags,
            visible: true
        },
        methods: {
            onFolderPathChange: function(fd) {
                var dpEntry = this.dataPaths.find(function(p) { return p.path === this.selectedPaths[fd.name]; }.bind(this));
                if (!dpEntry) return;
                this.choices[fd.name] = dpEntry.category || '人物模型';
                this.tagChoices[fd.name] = (dpEntry.tags || []).slice();
            },
            preview: function(path) { if (window._previewModel) window._previewModel(path); },
            toggleTag: function(key, tag) {
                var arr = this.tagChoices[key];
                if (!arr) { this.$set(this.tagChoices, key, []); arr = this.tagChoices[key]; }
                var idx = arr.indexOf(tag);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(tag);
            },
            confirm: function() {
                this.visible = false;
                var self = this;
                var total = this.folders.length;
                window.updateImportProgress({ visible: true, total: total, done: 0, text: '正在导入...' });
                var done = 0;
                function next() {
                    if (done >= total) {
                        window.updateImportProgress({ visible: false });
                        window.showNotify('导入完成 (' + total + ' 个文件夹)', 'success');
                        if (window.app && window.app.forceRescan) setTimeout(function() { window.app.forceRescan(); }, 500);
                        return;
                    }
                    var fd = self.folders[done];
                    window.updateImportProgress({ text: '导入: ' + fd.name, detail: '(' + (done + 1) + '/' + total + ')', done: done });
                    destPath = self.selectedPaths[fd.name] + window.path.sep + fd.name;
                    // Copy first model's source directory (the whole folder)
                    var copySrc = window.path.dirname(fd.models[0].src);
                    window.copyFolder(copySrc, destPath).then(function(res) {
                        var finalDest = res.success ? (res.dest || destPath) : destPath;
                        if (res.success) {
                            fd.models.forEach(function(m) {
                                var modelDest = finalDest + window.path.sep + window.path.basename(m.src);
                                window._addItemToDataJson({
                                    path: modelDest, category: self.choices[fd.name] || '人物模型',
                                    group: fd.name, tags: self.tagChoices[fd.name] || []
                                });
                            });
                        }
                        done++; window.updateImportProgress({ done: done }); next();
                    });
                }
                next();
                setTimeout(function() { vm.$destroy(); if (el.parentNode) el.parentNode.removeChild(el); }, 300);
            },
        },
        template:
            '<div>' +
            '<el-dialog title="导入文件夹" :visible.sync="visible" width="780px" :close-on-click-modal="false">' +
            '  <div style="max-height:400px;overflow-y:auto">' +
            '    <div v-for="fd in folders" :key="fd.name" style="padding:8px 0;border-bottom:1px solid #eee">' +
            '      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
            '        <span style="font-size:14px;font-weight:bold;flex:1">{{fd.name}}</span>' +
            '        <el-select v-model="selectedPaths[fd.name]" size="small" style="width:200px" @change="onFolderPathChange(fd)">' +
            '          <el-option v-for="dp in dataPaths" :key="dp.path" :label="dp.path" :value="dp.path"></el-option>' +
            '        </el-select>' +
            '        <el-select v-model="choices[fd.name]" size="small" style="width:120px">' +
            '          <el-option v-for="c in categories" :key="c.name" :label="c.name" :value="c.name"></el-option>' +
            '        </el-select>' +
            '      </div>' +
            '      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">' +
            '        <el-button v-for="m in fd.models" :key="m.src" size="mini" circle @click="preview(m.src)">模</el-button>' +
            '        <div v-if="tags.length" style="display:flex;gap:2px;flex-wrap:wrap">' +
            '          <span v-for="t in tags" :key="t" style="font-size:9px;border-radius:2px;padding:1px 4px;cursor:pointer" :style="tagChoices[fd.name]&&tagChoices[fd.name].indexOf(t)>=0?\'background:#67c23a;color:#fff\':\'background:#eee;color:#999\'" @click="toggleTag(fd.name, t)">{{t}}</span>' +
            '        </div>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '  <span slot="footer">' +
            '    <el-button type="primary" size="small" @click="confirm">导入 (' + folderList.length + ' 个文件夹)</el-button>' +
            '  </span>' +
            '</el-dialog>' +
            '</div>',
    });
}

// Classification dialog — choose category for each model
window.showBatchClassifyDialog = function(items, callback) {
    var settingsRef = (window.store && window.store.state && window.store.state.settings) || {};
var cats = settingsRef.categories || [];
    if (cats.length === 0) cats = [
        { name: '人物模型', extensions: '.pmx,.pmd' },
        { name: '场景模型', extensions: '.pmx,.x' },
        { name: '动作文件', extensions: '.vmd' },
        { name: 'MME特效', extensions: '.fx,.x' }
    ];
    var tags = settingsRef.tags || [];
    var el = document.createElement('div');
    document.body.appendChild(el);
    // Group by folder
    var folders = {}, folderList = [];
    items.forEach(function(r) {
        var groupName = r.group || window.path.basename(window.path.dirname(r.src));
        if (!folders[groupName]) { folders[groupName] = { name: groupName, models: [] }; folderList.push(folders[groupName]); }
        folders[groupName].models.push(r);
    });
    var choices = {};
    var tagChoices = {};
    folderList.forEach(function(fd) {
        var first = fd.models[0];
        choices[fd.name] = first.defaultCategory || cats[0].name;
        tagChoices[fd.name] = (first.defaultTags || []).slice();
    });
    var vm = new Vue({
        el: el,
        data: { folders: folderList, choices: choices, tagChoices: tagChoices, categories: cats, tags: tags, visible: true },
        methods: {
            preview: function(path) { if (window._previewModel) window._previewModel(path); },
            toggleTag: function(key, tag) {
                var arr = this.tagChoices[key];
                if (!arr) { this.$set(this.tagChoices, key, []); arr = this.tagChoices[key]; }
                var idx = arr.indexOf(tag);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(tag);
            },
            allTagSelected: function(tag) {
                var self = this;
                return this.folders.every(function(fd) { return self.tagChoices[fd.name] && self.tagChoices[fd.name].indexOf(tag) >= 0; });
            },
            toggleAllTag: function(tag) {
                var all = this.allTagSelected(tag);
                var self = this;
                this.folders.forEach(function(fd) {
                    if (!self.tagChoices[fd.name]) self.$set(self.tagChoices, fd.name, []);
                    var arr = self.tagChoices[fd.name];
                    var idx = arr.indexOf(tag);
                    if (all && idx >= 0) arr.splice(idx, 1);
                    else if (!all && idx < 0) arr.push(tag);
                });
            },
            confirm: function() {
                this.visible = false;
                var out = {}, outTags = {};
                this.folders.forEach(function(fd) {
                    fd.models.forEach(function(m) {
                        out[m.src] = choices[fd.name];
                        outTags[m.src] = (tagChoices[fd.name] || []).slice();
                    });
                });
                callback(out, outTags);
                setTimeout(function() { vm.$destroy(); if (el.parentNode) el.parentNode.removeChild(el); }, 300);
            },
        },
        template:
            '<div>' +
            '<el-dialog title="选择导入类别和标签" :visible.sync="visible" width="780px" :close-on-click-modal="false">' +
            '  <div v-if="tags.length" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px">' +
            '    <span style="font-size:12px;color:#909399;margin-right:4px">全局标签：</span>' +
            '    <el-tag v-for="t in tags" :key="t" size="small" :type="allTagSelected(t)?\'success\':\'info\'" style="cursor:pointer" @click="toggleAllTag(t)">{{t}}</el-tag>' +
            '  </div>' +
            '  <div style="max-height:400px;overflow-y:auto">' +
            '    <div v-for="fd in folders" :key="fd.name" style="padding:8px 0;border-bottom:1px solid #eee">' +
            '      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
            '        <span style="font-size:14px;font-weight:bold;flex:1">{{fd.name}}</span>' +
            '        <el-select v-model="choices[fd.name]" size="small" style="width:140px;flex-shrink:0">' +
            '          <el-option v-for="c in categories" :key="c.name" :label="c.name" :value="c.name"></el-option>' +
            '        </el-select>' +
            '      </div>' +
            '      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">' +
            '        <el-button v-for="m in fd.models" :key="m.src" size="mini" circle @click="preview(m.src)">模</el-button>' +
            '        <div v-if="tags.length" style="display:flex;gap:2px;flex-wrap:wrap">' +
            '          <span v-for="t in tags" :key="t" style="font-size:9px;border-radius:2px;padding:1px 4px;cursor:pointer" :style="tagChoices[fd.name]&&tagChoices[fd.name].indexOf(t)>=0?\'background:#67c23a;color:#fff\':\'background:#eee;color:#999\'" @click="toggleTag(fd.name, t)">{{t}}</span>' +
            '        </div>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '  <span slot="footer">' +
            '    <el-button type="primary" size="small" @click="confirm">确认</el-button>' +
            '  </span>' +
            '</el-dialog>' +
            '</div>',
    });
};


