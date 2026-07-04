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
    var files = collectDropFiles(droppedPath);
    if (files.length === 0) return;
    showDropImportDialog(files);
}

window.handleBatchDrop = function(paths, total) {
    var allFiles = [];
    paths.forEach(function(p) {
        allFiles = allFiles.concat(collectDropFiles(p));
    });
    if (allFiles.length === 0) return;
    showDropImportDialog(allFiles);
};

function collectDropFiles(srcPath) {
    var files = [];
    try {
        var stats = window.fs.statSync(srcPath);
        if (!stats.isDirectory) {
            var ext = window.path.extname(srcPath).toLowerCase();
            var allowed = getMonitoredExtensions();
            if (allowed[ext]) {
                files.push({ src: srcPath, name: window.path.basename(srcPath) });
            }
        } else {
            scanDropDir(srcPath + '/', files);
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

function scanDropDir(dir, files) {
    var list;
    try { list = window.fs.readdirSync(dir); } catch(e) { return; }
    var allowed = getMonitoredExtensions();
    for (var i = 0; i < list.length; i++) {
        var full = dir + list[i];
        var st;
        try { st = window.fs.statSync(full); } catch(e) { continue; }
        if (st.isDirectory) { scanDropDir(full + '/', files); }
        else {
            var ext = window.path.extname(list[i]).toLowerCase();
            if (allowed[ext]) {
                files.push({ src: full, name: list[i] });
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
    files.forEach(function(f) {
        selectedPaths[f.src] = dataPaths[0].path;
        choices[f.src] = dataPaths[0].category || '人物模型';
        tagChoices[f.src] = (dataPaths[0].tags || []).slice();
    });

    var vm = new Vue({
        el: el,
        data: {
            files: files, dataPaths: dataPaths, selectedPaths: selectedPaths,
            choices: choices, tagChoices: tagChoices, categories: cats, tags: tags,
            visible: true
        },
        methods: {
            onFilePathChange: function(src) {
                var dpEntry = this.dataPaths.find(function(p) { return p.path === this.selectedPaths[src]; }.bind(this));
                if (!dpEntry) return;
                this.choices[src] = dpEntry.category || '人物模型';
                this.tagChoices[src] = (dpEntry.tags || []).slice();
            },
            preview: function(path) {
                if (window._previewModel) window._previewModel(path);
            },
            toggleTag: function(src, tag) {
                var arr = this.tagChoices[src];
                if (!arr) { this.$set(this.tagChoices, src, []); arr = this.tagChoices[src]; }
                var idx = arr.indexOf(tag);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(tag);
            },
            toggleAllTag: function(tag) {
                var all = this.files.every(function(f) { return this.tagChoices[f.src] && this.tagChoices[f.src].indexOf(tag) >= 0; }.bind(this));
                var self = this;
                this.files.forEach(function(f) {
                    if (!self.tagChoices[f.src]) self.$set(self.tagChoices, f.src, []);
                    var arr = self.tagChoices[f.src];
                    var idx = arr.indexOf(tag);
                    if (all && idx >= 0) arr.splice(idx, 1);
                    else if (!all && idx < 0) arr.push(tag);
                });
            },
            confirm: function() {
                this.visible = false;
                var self = this;
                var total = this.files.length;
                window.updateImportProgress({ visible: true, total: total, done: 0, text: '正在导入...' });
                var done = 0;
                function next() {
                    if (done >= total) {
                        window.updateImportProgress({ visible: false });
                        window.showNotify('导入完成 (' + total + ' 个文件)', 'success');
                        if (window.app && window.app.forceRescan) {
                            setTimeout(function() { window.app.forceRescan(); }, 500);
                        }
                        return;
                    }
                    var f = self.files[done];
                    window.updateImportProgress({ text: '导入: ' + f.name, detail: '(' + (done + 1) + '/' + total + ')', done: done });
                    var destPath = self.selectedPaths[f.src] + window.path.sep + window.path.basename(f.src);
                    window.copyFolder(f.src, destPath).then(function(res) {
                        var finalDest = res.success ? (res.dest || destPath) : destPath;
                        if (res.success) {
                            window._addItemToDataJson({
                                path: finalDest,
                                category: self.choices[f.src] || '人物模型',
                                group: window.path.basename(window.path.dirname(finalDest)),
                                tags: self.tagChoices[f.src] || []
                            });
                        }
                        done++;
                        window.updateImportProgress({ done: done });
                        next();
                    });
                }
                next();
                setTimeout(function() { vm.$destroy(); if (el.parentNode) el.parentNode.removeChild(el); }, 300);
            },
        },
        template:
            '<div>' +
            '<el-dialog title="导入文件" :visible.sync="visible" width="860px" :close-on-click-modal="false">' +
            '  <div style="max-height:450px;overflow-y:auto">' +
            '    <div v-for="f in files" :key="f.src" style="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid #eee;gap:8px">' +
            '      <el-button size="mini" circle @click="preview(f.src)">模</el-button>' +
            '      <div style="flex:1;min-width:0;font-size:13px;word-break:break-all">{{f.name}}</div>' +
            '      <el-select v-model="selectedPaths[f.src]" size="small" style="width:200px;flex-shrink:0" @change="onFilePathChange(f.src)" placeholder="保存路径">' +
            '        <el-option v-for="dp in dataPaths" :key="dp.path" :label="dp.path" :value="dp.path"></el-option>' +
            '      </el-select>' +
            '      <el-select v-model="choices[f.src]" size="small" style="width:120px;flex-shrink:0">' +
            '        <el-option v-for="c in categories" :key="c.name" :label="c.name" :value="c.name"></el-option>' +
            '      </el-select>' +
            '      <div v-if="tags.length" style="display:flex;gap:2px;flex-shrink:0;max-width:120px;flex-wrap:wrap">' +
            '        <span v-for="t in tags" :key="t" style="font-size:9px;border-radius:2px;padding:1px 4px;cursor:pointer" :style="tagChoices[f.src]&&tagChoices[f.src].indexOf(t)>=0?\'background:#67c23a;color:#fff\':\'background:#eee;color:#999\'" @click="toggleTag(f.src, t)">{{t}}</span>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '  <span slot="footer">' +
            '    <el-button type="primary" size="small" @click="confirm">导入 (' + files.length + ' 个文件)</el-button>' +
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
    var choices = {};
    var tagChoices = {};
    items.forEach(function(r) {
        choices[r.src] = r.defaultCategory || cats[0].name;
        tagChoices[r.src] = (r.defaultTags || []).slice();
    });
    var vm = new Vue({
        el: el,
        data: { choices: choices, tagChoices: tagChoices, items: items, categories: cats, tags: tags, visible: true },
        methods: {
            preview: function(path) {
                if (window._previewModel) window._previewModel(path);
            },
            toggleTag: function(src, tag) {
                var arr = this.tagChoices[src];
                if (!arr) { this.$set(this.tagChoices, src, []); arr = this.tagChoices[src]; }
                var idx = arr.indexOf(tag);
                if (idx >= 0) arr.splice(idx, 1);
                else arr.push(tag);
            },
            allTagSelected: function(tag) {
                var self = this;
                return this.items.every(function(item) {
                    return self.tagChoices[item.src] && self.tagChoices[item.src].indexOf(tag) >= 0;
                });
            },
            toggleAllTag: function(tag) {
                var all = this.allTagSelected(tag);
                var self = this;
                this.items.forEach(function(item) {
                    if (!self.tagChoices[item.src]) self.$set(self.tagChoices, item.src, []);
                    var arr = self.tagChoices[item.src];
                    var idx = arr.indexOf(tag);
                    if (all && idx >= 0) arr.splice(idx, 1);
                    else if (!all && idx < 0) arr.push(tag);
                });
            },
            confirm: function() {
                this.visible = false;
                callback(this.choices, this.tagChoices);
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
            '    <div v-for="item in items" :key="item.src" style="display:flex;align-items:flex-start;padding:6px 0;border-bottom:1px solid #eee;gap:8px">' +
            '      <el-button size="mini" circle @click="preview(item.src)" title="预览模型">模</el-button>' +
            '      <div style="flex:1;min-width:0">' +
            '        <div style="font-size:13px;word-break:break-all">{{item.name}}</div>' +
            '        <div style="font-size:10px;color:#909399;margin-top:1px">' +
            '          <span style="color:#e6a23c">{{item.defaultCategory||""}}</span>' +
            '        </div>' +
            '        <div v-if="tags.length" style="margin-top:3px;display:flex;flex-wrap:wrap;gap:2px">' +
            '          <span v-for="t in tags" :key="t" style="font-size:9px;border-radius:2px;padding:1px 4px;cursor:pointer" :style="tagChoices[item.src]&&tagChoices[item.src].indexOf(t)>=0?\'background:#67c23a;color:#fff\':\'background:#eee;color:#999\'" @click="toggleTag(item.src, t)">{{t}}</span>' +
            '        </div>' +
            '      </div>' +
            '      <el-select v-model="choices[item.src]" size="small" style="width:140px;flex-shrink:0">' +
            '        <el-option v-for="c in categories" :key="c.name" :label="c.name" :value="c.name"></el-option>' +
            '      </el-select>' +
            '    </div>' +
            '  </div>' +
            '  <span slot="footer">' +
            '    <el-button type="primary" size="small" @click="confirm">确认</el-button>' +
            '  </span>' +
            '</el-dialog>' +
            '</div>',
    });
};


