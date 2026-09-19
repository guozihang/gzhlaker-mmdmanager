function longestCommonSubstring(a, b) {
    if (!a || !b) return 0;
    var lenA = a.length, lenB = b.length;
    var maxLen = 0;
    for (var i = 0; i < lenA; i++) {
        for (var j = 0; j < lenB; j++) {
            var k = 0;
            while (i + k < lenA && j + k < lenB && a[i + k] === b[j + k]) k++;
            if (k > maxLen) maxLen = k;
        }
    }
    return maxLen / Math.max(lenA, lenB);
}
/*----------------------------------------------------
# ● Init主界面的组件
----------------------------------------------------*/
function getDefaultConfig() {
    return {
        version: '1.0',
        items: [],
        important: [],
        settings: {
            dataPath: '',
            dataPaths: [],
            defaultModelPath: '',
            categories: [
                { name: '人物模型', extensions: '.pmx,.pmd', parent: '', type: 'model' },
                { name: '场景模型', extensions: '.pmx', parent: '', type: 'model' },
                { name: '动作文件', extensions: '.vmd', parent: '', type: 'motion' }
            ],
            tags: [],
            availableExtensions: '.pmx,.pmd,.x,.vmd,.fx',
            preview: {
                ambientColor: '#666666', directionalColor: '#887766',
                showAxis: true, autoRotate: false, cameraFov: 45, cameraDistance: 30,
                dualModel: false, showSkybox: true,
                skyboxMode: 'color', skyboxImagePath: '',
                skyColorTop: '#FFFFFF', skyColorBottom: '#F0F0F0', skyColorSide: '#FFFFFF',
                buttonMode: 'hover', pageSize: 20,
                thumbnailWidth: 48, thumbnailHeight: 48,
                gridThumbWidth: 128, gridThumbHeight: 128,
                viewMode: 'table', coexistEnabled: false, coexistCategories: [], defaultModelMode: 'custom'
            },
            render: {
                ambientColor: '#666666', directionalColor: '#887766',
                showAxis: false, autoRotate: false, cameraFov: 45, cameraDistance: 30,
                showSkybox: true, skyboxMode: 'color', skyboxImagePath: '',
                skyColorTop: '#FFFFFF', skyColorBottom: '#F0F0F0', skyColorSide: '#FFFFFF'
            }
        }
    };
}

function migrateConfig(raw) {
    // Migrate old config format to v1.0
    var s = raw.settings || {};
    // Ensure dataPaths exists
    if (!s.dataPaths) {
        s.dataPaths = s.dataPath ? [{ path: s.dataPath, category: '人物模型', tags: [] }] : [];
    } else {
        s.dataPaths.forEach(function(p) {
            if (!p.category) p.category = '人物模型';
            if (!p.tags) p.tags = [];
            delete p.mode; // Remove old mode field
        });
    }
    // Clean up old fields
    delete s.dataPathMode;
    delete s.dualModel; // Replaced by coexistCategories
    // Ensure new fields exist
    if (!s.preview) s.preview = {};
    if (s.preview.coexistEnabled === undefined) s.preview.coexistEnabled = false;
    if (!s.preview.coexistCategories) s.preview.coexistCategories = [];
    if (!s.render) s.render = {};
    var defPrev = getDefaultConfig().settings.preview;
    var defRender = getDefaultConfig().settings.render;
    for (var k in defPrev) { if (s.preview[k] === undefined) s.preview[k] = defPrev[k]; }
    for (var k2 in defRender) { if (s.render[k2] === undefined) s.render[k2] = defRender[k2]; }
    if (!s.categories) s.categories = getDefaultConfig().settings.categories;
    if (!s.tags) s.tags = [];
    if (!s.availableExtensions) s.availableExtensions = '.pmx,.pmd,.x,.vmd,.fx';
    if (s.render && s.render.skyColorTop === undefined) {
        s.render.skyColorTop = '#FFFFFF';
        s.render.skyColorBottom = '#F0F0F0';
        s.render.skyColorSide = '#FFFFFF';
    }
    raw.settings = s;
    raw.version = '1.0';
    raw._migrated = true;
    return raw;
}

function getMonitoredExtensionsSet() {
    var cats = (window.store && window.store.state.settings && window.store.state.settings.categories) || [];
    var map = {};
    cats.forEach(function(c) {
        (c.extensions || '').split(',').forEach(function(e) {
            e = e.trim().toLowerCase();
            if (e) map[e] = true;
        });
    });
    return map;
}

var componentInit = {
    template: `#tInit`,
    methods: {
        init: function () {
            /*----------------------
            # ● 读取配置文件（优先，影响后续路径）
            ----------------------*/
            var applyDataPath = function(dp) {
                // PathManager no longer needs these; all paths are user-configured
            };

            var applySettings = function(cfg) {
                // Upgrade old format
                if (cfg && cfg.dataPath && !cfg.dataPaths) {
                    cfg.dataPaths = [{ path: cfg.dataPath, category: '人物模型', tags: [] }];
                }
                if (cfg && cfg.dataPaths && cfg.dataPaths.length > 0) {
                    cfg.dataPaths.forEach(function(p) {
                        if (!p.category) p.category = '人物模型';
                        if (!p.tags) p.tags = [];
                    });
                }
                if (cfg && cfg.defaultModelPath !== undefined) {
                    this.$store.state.settings.defaultModelPath = cfg.defaultModelPath;
                }
            }.bind(this);
            // Phase 1: create config directory and read data.json
            var configDir = PathManager.CONFIGPATH;
            console.log("Config dir:", configDir);
            console.log("CONFIGPATH:", PathManager.CONFIGPATH);
            console.log("getDataFullPath:", PathManager.getDataFullPath());
            if (!fs.existsSync(configDir)) {
                console.log("Creating config dir:", configDir);
                try { fs.mkdirSync(configDir, { recursive: true }); } catch(e) { console.log("mkdir failed:", e); }
            }
            var dataJsonPath = PathManager.getDataFullPath();
            var raw = null;
            if (fs.existsSync(dataJsonPath)) {
                try {
                    raw = JSON.parse(fs.readFileSync(dataJsonPath).toString('utf8'));
                } catch(e) { raw = null; }
            }
            // Migrate old config or create default
            if (!raw) {
                raw = getDefaultConfig();
            } else {
                // All configs go through migration to fill in any missing fields
                raw = migrateConfig(raw);
            }
            if (raw.settings) {
                applySettings(raw.settings);
                this.$store.state.settings = raw.settings;
            }
            // Ensure version is set
            raw.version = '1.0';
            // Save migrated/default config
            if (!fs.existsSync(dataJsonPath) || (raw.settings && !raw._migrated)) {
                try { fs.writeFileSync(dataJsonPath, JSON.stringify(raw, null, 2)); } catch(e) {}
            }
            /*----------------------
            # ● 从 data.json 读取所有数据
            ----------------------*/
            var loadDataFromJson = function() {
                try {
                    if (!fs.existsSync(dataJsonPath)) {
                        fs.writeFileSync(dataJsonPath, JSON.stringify({ items: [], important: [], settings: this.$store.state.settings }, null, 2));
                    }
                    var raw = JSON.parse(fs.readFileSync(dataJsonPath).toString('utf8'));
                    window.store.state.important = raw.important || [];
                    var items = raw.items || [];
                    var data = { models: [], scenes: [], vmds: [], mmes: [], project: [] };
                    var catMap = { '人物模型': 'models', '场景模型': 'scenes', '动作文件': 'vmds', 'MME特效': 'mmes' };
                    var cats = (raw.settings && raw.settings.categories) || [];
                    cats.forEach(function(c) { if (!catMap[c.name]) catMap[c.name] = c.type === 'motion' ? 'vmds' : c.type === 'effect' ? 'mmes' : 'models'; });
                    var seenGroups = {};
                    items.forEach(function(item, idx) {
                        var key = catMap[item.category] || 'models';
                        var groupName = item.group || window.path.basename(item.path).replace(/\.[^.]+$/, '');
                        var idKey = key + '|' + groupName;
                        if (!seenGroups[idKey]) {
                            seenGroups[idKey] = { id: Object.keys(seenGroups).length, name: groupName, address: item.path ? window.path.dirname(item.path) + '/' : '', models: [], vmds: [], img: 'yes', type: 'no', info: { tags: [] } };
                            data[key].push(seenGroups[idKey]);
                        }
                        var ext = window.path.extname(item.path).toLowerCase();
                        if (ext === '.vmd') {
                            seenGroups[idKey].vmds.push(item.path);
                        } else {
                            seenGroups[idKey].models.push(item.path);
                        }
                        // Aggregate per-item tags to group level
                        if (item.tags && item.tags.length > 0) {
                            var gInfo = seenGroups[idKey].info;
                            if (!gInfo.tags) gInfo.tags = [];
                            item.tags.forEach(function(t) {
                                if (gInfo.tags.indexOf(t) < 0) gInfo.tags.push(t);
                            });
                            seenGroups[idKey].type = 'yes';
                        }
                    });
                    this.$store.state.data = data;
                    window._buildItemIndex(raw);
                    // Init bookmark map
                    var bmInit = {};
                    items.forEach(function(i) { if (i.bookmarked) bmInit[i.path] = true; });
                    this._bookmarkedPaths = bmInit;
                } catch(e) {
                    console.error('Failed to load data.json:', e);
                    this.$store.state.data = { models: [], scenes: [], vmds: [], mmes: [], project: [] };
                }
            }.bind(this);
            loadDataFromJson();

            /*----------------------
            # ● 进入主菜单
            ----------------------*/
            this.message("初始化完成");
            router.replace("/index");
        },
        message: function (info) {
            const h = this.$createElement;
            this.$notify({
                title: "消息",
                message: h("i", { style: "color: teal" }, info),
            });
        },
    },
    beforeRouteEnter: (to, from, next) => {
        next((vm) => {
            setTimeout(() => {
                vm.init();
            }, 1000);
        });
    },
};
/*----------------------------------------------------
# ● 入口界面的组件
----------------------------------------------------*/
var componentIndex = {
    template: `#tIndex`,
    data() {
        return {
            categoryDialogVisible: false,
            categoryDialogTitle: '',
            categoryForm: { name: '', extensions: [], parent: '' },
            categoryEditIndex: -1,
            newTagInput: '',
            newExtInput: '',
            tagEditDialogVisible: false,
            tagEditModelPath: '',
            tagEditCategory: '',
            tagEditSelected: [],
            tagEditGroup: null,
            tagEditNsfw: false,
            dataPathDialogVisible: false,
            dataPathEditingIndex: -1,
            dataPathForm: { path: '', category: '人物模型', tags: '' },
            settingsDialogVisible: false,
            helpDialogVisible: false,
            _bookmarkVersion: 0,
            _bookmarkedPaths: {},
            searchText: '',
            activeFilters: [], // [{type: 'tag', value: 'xxx'}, {type: 'category', value: 'xxx'}]
            searchSuggestions: [],
            suggestionVisible: false,
            suggestionIndex: -1,
        };
    },
    computed: {
        showPath: {
            get() {
                return this.$store.state.showPath;
            },
            set(value) {
                this.$store.commit("showPath", value);
            },
        },
        important: {
            get() {
                return this.$store.state.important;
            },
        },
        settings: {
            get() {
                return this.$store.state.settings;
            },
            set(value) {
                this.$store.commit("settings", value);
            },
        },
        categories: {
            get() { return this.$store.state.settings.categories || []; },
        },
        categoryDataMap: {
            // Map category name → store data key
            get() {
                var map = {};
                map['人物模型'] = 'models';
                map['场景模型'] = 'scenes';
                map['动作文件'] = 'vmds';
                map['MME特效'] = 'mmes';
                // Also map custom categories by their own name
                (this.categories).forEach(function(c) {
                    if (!map[c.name]) map[c.name] = c.name;
                });
                return map;
            },
        },
        categoryTree: {
            get() {
                var cats = this.categories;
                function buildTree(parent) {
                    return cats.filter(function(c) { return c.parent === parent; }).map(function(c) {
                        return { name: c.name, label: c.name, extensions: c.extensions, parent: c.parent, children: buildTree(c.name) };
                    });
                }
                return buildTree('');
            },
        },
        availableExtList: {
            get() {
                var src = this.settings.availableExtensions || '.pmx,.pmd,.x,.vmd,.fx';
                return src.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e; });
            },
        },
        monitoredExtensions: {
            get() {
                var exts = [];
                var seen = {};
                (this.categories || []).forEach(function(c) {
                    (c.extensions || '').split(',').forEach(function(e) {
                        e = e.trim().toLowerCase();
                        if (e && !seen[e]) { seen[e] = true; exts.push(e); }
                    });
                });
                return exts.join(',');
            },
        },
        gridItems: {
            get() {
                var _trigger = this._bookmarkVersion; // re-evaluate on edit
                var self = this;
                var data = this.getCategoryData(null);
                var items = [];
                data.forEach(function (group) {
                    var models = group.models || [];
                    models.forEach(function (mp) {
                        items.push({
                            path: mp,
                            modelName: window.path.basename(mp).replace(/\.[^.]+$/, ''),
                            groupName: group.name,
                            groupInfo: group.info,
                            groupType: group.type,
                            category: self._getItemCategory(mp),
                            group: group,
                        });
                    });
                });
                return items;
            },
        },
    },
    methods: {
        open: function (address) {
            window.shell.openPath(address);
        },
        vip: function (modelPath) {
            // Toggle bookmark for a single model
            var self = this;
            var dp = PathManager.getDataFullPath();
            var data = {};
            if (fs.existsSync(dp)) {
                try { data = JSON.parse(fs.readFileSync(dp).toString('utf8')); } catch(e) {}
            }
            if (!data.items) data.items = [];
            var item = data.items.find(function(i) { return i.path === modelPath; });
            var newState = !(item && item.bookmarked);
            if (item) {
                item.bookmarked = newState;
            } else {
                data.items.push({ path: modelPath, bookmarked: newState, category: '', group: '' });
            }
            data.settings = self.settings;
            fs.writeFileSync(dp, JSON.stringify(data, null, 2));
            self._invalidateItemCategoryCache();
            var bm = {};
            (data.items || []).forEach(function(i) { if (i.bookmarked) bm[i.path] = true; });
            self._bookmarkedPaths = bm;
            self._bookmarkVersion = (self._bookmarkVersion || 0) + 1;
            self.$forceUpdate();
            self.message(newState ? "已收藏" : "已取消收藏");
        },
        isBookmarked: function(modelPath) {
            if (!modelPath) return false;
            var bm = this._bookmarkedPaths;
            if (!bm) {
                this._bookmarkedPaths = {};
                try {
                    var dp = PathManager.getDataFullPath();
                    var raw = JSON.parse(fs.readFileSync(dp).toString('utf8'));
                    (raw.items || []).forEach(function(i) {
                        if (i.bookmarked) this._bookmarkedPaths[i.path] = true;
                    }.bind(this));
                } catch(e) {}
                bm = this._bookmarkedPaths;
            }
            return !!bm[modelPath];
        },
        _isItemNsfw: function(mp) {
            var entry = (this.$store.state.itemIndex || {})[mp];
            return !!(entry && entry.nsfw);
        },
        _getItemBookmarked: function(mp) {
            var entry = (this.$store.state.itemIndex || {})[mp];
            return !!(entry && entry.bookmarked);
        },
        save: function () {
            var dp = PathManager.getDataFullPath();
            var data = {};
            if (fs.existsSync(dp)) {
                try { data = JSON.parse(fs.readFileSync(dp).toString('utf8')); } catch(e) {}
            }
            data.important = this.$store.state.important;
            data.settings = this.$store.state.settings;
            data.version = '1.0';
            window.fs.writeFile(dp, JSON.stringify(data), (err) => {
                if (err) throw err;
                this.message("保存成功");
            });
        },
        openParent: function(fp) {
            window.shell.openPath(window.path.dirname(fp));
        },
        copy: function (data) {
            window.clipboard.writeText(data);
        },
        changeTag: function (tagName) {
            if (!this.activeFilters.some(function(f) { return f.type === 'tag' && f.value === tagName; })) {
                this.activeFilters = this.activeFilters.concat([{ type: 'tag', value: tagName }]);
            }
        },
        filterByCategory: function(catName) {
            if (!this.activeFilters.some(function(f) { return f.type === 'category' && f.value === catName; })) {
                this.activeFilters = this.activeFilters.concat([{ type: 'category', value: catName }]);
            }
        },
        removeFilter: function(idx) {
            var arr = this.activeFilters.slice();
            arr.splice(idx, 1);
            this.activeFilters = arr;
        },
        clearFilters: function () {
            this.activeFilters = [];
            this.searchText = '';
        },
        onSearchKeydown: function(e) {
            if (e.key === 'Backspace' && this.searchText === '' && this.activeFilters.length > 0 && !this.suggestionVisible) {
                e.preventDefault();
                this.activeFilters = this.activeFilters.slice(0, -1);
                return;
            }
            if (!this.suggestionVisible || this.searchSuggestions.length === 0) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.suggestionIndex = Math.min(this.suggestionIndex + 1, this.searchSuggestions.length - 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.suggestionIndex <= 0) {
                    this.suggestionIndex = -1;
                } else {
                    this.suggestionIndex--;
                }
            } else if (e.key === 'Enter' && this.suggestionIndex >= 0) {
                e.preventDefault();
                this.selectSuggestion(this.searchSuggestions[this.suggestionIndex]);
            } else if (e.key === 'Escape') {
                this.suggestionVisible = false;
                this.searchSuggestions = [];
                this.suggestionIndex = -1;
            }
        },
        onSearchInput: function() {
            this.suggestionIndex = -1;
            var text = this.searchText;
            var idx = text.lastIndexOf('@');
            var hashIdx = text.lastIndexOf('#');
            var dollarIdx = text.lastIndexOf('$');
            var exclIdx = text.lastIndexOf('!');
            if (dollarIdx >= 0 && dollarIdx > idx && dollarIdx > hashIdx && dollarIdx > exclIdx) {
                this.suggestionVisible = true;
                this.searchSuggestions = [{ type: 'bookmark', value: 'bookmark', label: '$ 已收藏' }];
            } else if (exclIdx >= 0 && exclIdx > idx && exclIdx > hashIdx && exclIdx > dollarIdx) {
                var isDouble = text.indexOf('!!') >= 0;
                this.suggestionVisible = true;
                this.searchSuggestions = [
                    { type: 'nsfw', value: 'nsfw', label: '! 显示全部(含NSFW)' },
                    { type: 'nsfwOnly', value: 'nsfwOnly', label: '!! 只显示NSFW' }
                ];
            } else if (idx >= 0 && idx > hashIdx && idx > dollarIdx && idx > exclIdx) {
                var prefix = text.slice(idx + 1).toLowerCase();
                this.suggestionVisible = true;
                this.searchSuggestions = this.categories
                    .filter(function(c) { return c.name.toLowerCase().indexOf(prefix) >= 0; })
                    .map(function(c) { return { type: 'category', value: c.name, label: '@' + c.name }; });
            } else if (hashIdx >= 0) {
                var tagPrefix = text.slice(hashIdx + 1).toLowerCase();
                this.suggestionVisible = true;
                var tags = this.settings.tags || [];
                this.searchSuggestions = tags
                    .filter(function(t) { return t.toLowerCase().indexOf(tagPrefix) >= 0; })
                    .map(function(t) { return { type: 'tag', value: t, label: '#' + t }; });
            } else {
                this.suggestionVisible = false;
                this.searchSuggestions = [];
            }
        },
        selectSuggestion: function(s) {
            if (!this.activeFilters.some(function(f) { return f.type === s.type && f.value === s.value; })) {
                this.activeFilters = this.activeFilters.concat([{ type: s.type, value: s.value }]);
            }
            // Remove the @xxx, #xxx, or $ from search text
            var text = this.searchText;
            var trigger = s.type === 'category' ? '@' : (s.type === 'bookmark' ? '$' : (s.type === 'nsfw' || s.type === 'nsfwOnly' ? '!' : '#'));
            var idx = (s.type === 'bookmark' || s.type === 'nsfw' || s.type === 'nsfwOnly') ? text.lastIndexOf(trigger) : text.lastIndexOf(trigger + s.value);
            if (idx === -1) {
                idx = text.lastIndexOf(trigger);
            }
            if (idx >= 0) {
                var before = text.slice(0, idx);
                // Also remove up to next space or end
                var afterIdx = idx + 1 + s.value.length;
                this.searchText = (before + text.slice(afterIdx)).trim();
            }
            this.suggestionVisible = false;
            this.searchSuggestions = [];
        },
        applyFilters: function(arr) {
            var self = this;
            var index = this.$store.state.itemIndex || {};
            var text = self.searchText || '';
            var cleanText = text.replace(/[$@#!][^\s]*/g, '').trim();
            var term = cleanText ? cleanText.toLowerCase() : '';
            // Collect every active condition once, then judge each group against
            // all of them in a single traversal instead of one pass per condition
            var hasNsfwFilter = false, hasNsfwOnlyFilter = false;
            var tagFilters = [], categoryFilters = [], hasBookmarkFilter = false;
            self.activeFilters.forEach(function(f) {
                if (f.type === 'nsfw') hasNsfwFilter = true;
                else if (f.type === 'nsfwOnly') hasNsfwOnlyFilter = true;
                else if (f.type === 'tag') tagFilters.push(f.value);
                else if (f.type === 'category') categoryFilters.push(f.value);
                else if (f.type === 'bookmark') hasBookmarkFilter = true;
            });
            // A category filter matches the value itself plus all its descendants;
            // with several active, each one must independently be hit by some model
            var catMatchSets = categoryFilters.map(function(filterName) {
                var set = {};
                set[filterName] = true;
                (self.categories || []).forEach(function(c) {
                    if (self._isCategoryDescendant(c.name, filterName)) set[c.name] = true;
                });
                return set;
            });
            var derived = categoryFilters.length > 0 ? self._derivedCategoryMap() : null;
            // Model-level pass is only needed when a condition depends on models;
            // with only "!" (show all incl. NSFW) active, groups pass as-is
            var needModelPass = hasNsfwOnlyFilter || !hasNsfwFilter || categoryFilters.length > 0 || hasBookmarkFilter;
            var catHits = categoryFilters.map(function() { return false; }); // reset per group below
            return arr.filter(function(group) {
                // Group-level conditions: text hit and aggregated tags
                if (term && group.name.toLowerCase().indexOf(term) === -1) return false;
                for (var ti = 0; ti < tagFilters.length; ti++) {
                    var gTags = group.info && group.info.tags;
                    if (!gTags || gTags.indexOf(tagFilters[ti]) < 0) return false;
                }
                if (!needModelPass) return true;
                // Model-level conditions: each must be satisfied by some model of the
                // group (models.some semantics, unchanged)
                for (var ri = 0; ri < catHits.length; ri++) catHits[ri] = false;
                var models = group.models || [];
                var hasNsfwModel = false, hasNonNsfwModel = false, hasBookmarked = false;
                for (var mi = 0; mi < models.length; mi++) {
                    var mp = models[mi];
                    var entry = index[mp];
                    var nsfw = !!(entry && entry.nsfw);
                    // NSFW policy: default hide, ! shows all, !! shows only NSFW
                    if (hasNsfwOnlyFilter) { if (nsfw) hasNsfwModel = true; }
                    else if (!hasNsfwFilter) { if (!nsfw) hasNonNsfwModel = true; }
                    if (!hasBookmarked && entry && entry.bookmarked) hasBookmarked = true;
                    if (categoryFilters.length > 0) {
                        var cat = (entry && entry.category) || derived[mp] || '';
                        if (cat) {
                            for (var fi = 0; fi < catMatchSets.length; fi++) {
                                if (!catHits[fi] && catMatchSets[fi][cat]) catHits[fi] = true;
                            }
                        }
                    }
                }
                if (hasNsfwOnlyFilter && !hasNsfwModel) return false;
                if (!hasNsfwFilter && !hasNsfwOnlyFilter && !hasNonNsfwModel) return false;
                for (var cj = 0; cj < catHits.length; cj++) {
                    if (!catHits[cj]) return false;
                }
                if (hasBookmarkFilter && !hasBookmarked) return false;
                return true;
            });
        },
        editTag: function (modelPath, group) {
            this.tagEditModelPath = modelPath;
            this.tagEditGroup = group;
            this.tagEditSelected = [];
            this.tagEditCategory = '';
            this.tagEditNsfw = false;
            var dp = PathManager.getDataFullPath();
            try {
                var raw = JSON.parse(fs.readFileSync(dp).toString('utf8'));
                (raw.items || []).forEach(function (item) {
                    if (item.path === modelPath) {
                        this.tagEditCategory = item.category || '';
                        this.tagEditSelected = item.tags ? item.tags.slice() : [];
                        this.tagEditNsfw = !!item.nsfw;
                    }
                }.bind(this));
            } catch(e) {}
            if (!this.tagEditCategory) {
                this.tagEditCategory = this.currentCategory || '';
            }
            this.tagEditDialogVisible = true;
        },
        saveTagEdit: function () {
            var self = this;
            var dp = PathManager.getDataFullPath();
            var data = {};
            if (fs.existsSync(dp)) {
                try { data = JSON.parse(fs.readFileSync(dp).toString('utf8')); } catch(e) {}
            }
            if (!data.items) data.items = [];
            var found = false;
            data.items.forEach(function (item) {
                if (item.path === self.tagEditModelPath) {
                    item.category = self.tagEditCategory;
                    item.tags = self.tagEditSelected.slice();
                    item.nsfw = self.tagEditNsfw;
                    found = true;
                }
            });
            if (!found) {
                data.items.push({
                    path: self.tagEditModelPath,
                    category: self.tagEditCategory,
                    group: window.path.basename(window.path.dirname(self.tagEditModelPath)),
                    tags: self.tagEditSelected.slice(),
                    nsfw: self.tagEditNsfw
                });
            }
            data.settings = self.settings;
            data.important = self.important;
            fs.writeFileSync(dp, JSON.stringify(data, null, 2));
            self.tagEditDialogVisible = false;
            self._invalidateItemCategoryCache();
            self._bookmarkVersion = (self._bookmarkVersion || 0) + 1;
            self.$forceUpdate();
            // Update the group info directly instead of full reload
            var group = self.tagEditGroup;
            if (group) {
                if (!group.info) self.$set(group, 'info', {});
                if (!group.info.tags) self.$set(group.info, 'tags', []);
                // Merge tags from edited item
                var newTags = self.tagEditSelected;
                newTags.forEach(function(t) {
                    if (group.info.tags.indexOf(t) < 0) group.info.tags.push(t);
                });
                if (group.info.tags.length > 0) {
                    self.$set(group, 'type', 'yes');
                }
            }
            self.message('已更新');
        },
        addTag: function () {
            var name = this.newTagInput.trim();
            if (!name) return;
            var tags = this.settings.tags || [];
            if (tags.indexOf(name) >= 0) {
                this.message('标签已存在', 'warning');
                return;
            }
            tags = tags.concat([name]);
            this.settings = Object.assign({}, this.settings, { tags: tags });
            this.newTagInput = '';
        },
        deleteTag: function (idx) {
            var tags = (this.settings.tags || []).slice();
            tags.splice(idx, 1);
            this.settings = Object.assign({}, this.settings, { tags: tags });
        },
        addExt: function() {
            var v = this.newExtInput.trim();
            if (!v) return;
            if (!v.startsWith('.')) v = '.' + v;
            v = v.toLowerCase();
            var list = this.availableExtList.slice();
            if (list.indexOf(v) < 0) {
                list.push(v);
                this.settings = Object.assign({}, this.settings, { availableExtensions: list.join(',') });
            }
            this.newExtInput = '';
        },
        removeExt: function(idx) {
            var list = this.availableExtList.slice();
            list.splice(idx, 1);
            this.settings = Object.assign({}, this.settings, { availableExtensions: list.join(',') });
        },
        updateModel: function (path) {
            var self = this;
            if (this.showPath != path) {
                // Check coexistence settings
                var coexistOn = self.settings.preview && self.settings.preview.coexistEnabled;
                var coexistCats = self.settings.preview && self.settings.preview.coexistCategories || [];
                var newCat = self._getItemCategory(path) || self._deriveCategoryFromStore(path);
                var newCanCoexist = coexistOn && (coexistCats.indexOf(newCat) >= 0);

                if (newCanCoexist) {
                    // Only remove same-category models
                    if (window.model && (self._getItemCategory(window.model.userData.modelPath) || self._deriveCategoryFromStore(window.model.userData.modelPath)) === newCat) {
                        window.scene.remove(window.model); clearCache(window.model); window.model = null;
                    }
                    if (window.sceneModel && (self._getItemCategory(window.sceneModel.userData.modelPath) || self._deriveCategoryFromStore(window.sceneModel.userData.modelPath)) === newCat) {
                        window.scene.remove(window.sceneModel); clearCache(window.sceneModel); window.sceneModel = null;
                    }
                } else {
                    // Not coexisting: clear all models
                    if (window.model) { window.scene.remove(window.model); clearCache(window.model); window.model = null; }
                    if (window.sceneModel) { window.scene.remove(window.sceneModel); clearCache(window.sceneModel); window.sceneModel = null; }
                }

                var ext = window.path.extname(path).toLowerCase();
                if (ext == ".pmx" || ext == ".pmd") {
                    window.loader.MMDLoader.loadModel(path, function (mmd) {
                        window.model = mmd;
                        mmd.userData.modelPath = path;
                        window.scene.add(window.model);
                        setupModel(mmd, false);
                        resetCamera();
                        self._capturePreviewAfterLoad(path);
                    }, window.onProgress, null);
                } else if (ext == ".x") {
                    window.loader.XLoader.load(path, function (x) {
                        window.model = x;
                        x.userData.modelPath = path;
                        window.scene.add(window.model);
                        setupModel(x, false);
                        resetCamera();
                        self._capturePreviewAfterLoad(path);
                    }, window.onProgress, null);
                }
                this.showPath = path;
            } else {
                stopAnimation();
                resetCamera();
                $("#modelButton").click();
            }
            $("#modelButton").click();
        },
        _getDefaultModelPath: function() {
            var mode = (this.settings.preview && this.settings.preview.defaultModelMode) || 'custom';
            // Collect all model paths
            var allModels = [];
            var data = this.$store.state.data;
            ['models', 'scenes'].forEach(function(k) {
                (data[k] || []).forEach(function(g) {
                    (g.models || []).forEach(function(mp) {
                        allModels.push(mp);
                    });
                });
            });
            if (mode === 'random' && allModels.length > 0) {
                return allModels[Math.floor(Math.random() * allModels.length)];
            }
            if (mode === 'first' && allModels.length > 0) {
                return allModels[0];
            }
            // custom mode
            return this.settings.defaultModelPath || (allModels.length > 0 ? allModels[0] : '');
        },
        playVmd: function (vmdPath) {
            var self = this;
            if (!window.model) {
                var defaultPath = self._getDefaultModelPath();
                if (!defaultPath) {
                    self.message("请先加载模型或导入模型文件");
                    return;
                }
                self.message("正在加载模型...");
                window.loader.MMDLoader.loadModel(defaultPath, function(mmd) {
                    window.model = mmd;
                    mmd.userData.modelPath = defaultPath;
                    model = mmd;
                    window.scene.add(window.model);
                    setupModel(mmd);
                    requestAnimationFrame(function() {
                        self._loadVmd(vmdPath);
                    });
                }, window.onProgress, function() {
                    self.message("模型加载失败");
                });
                return;
            }
            this._loadVmd(vmdPath);
        },
        _loadVmd: function(vmdPath) {
            var self = this;
            resetCamera();
            $("#modelButton").click();
            window.loader.MMDLoader.loadVmd(
                vmdPath,
                function (vmd) {
                    // Fuzzy match VMD bone names to model bones
                    var modelBones = window.model.geometry.bones;
                    if (modelBones) {
                        var modelNames = modelBones.map(function(b) { return b.name; });
                        for (var i = 0; i < vmd.motions.length; i++) {
                            var vName = vmd.motions[i].boneName;
                            if (modelNames.indexOf(vName) !== -1) continue;
                            // Find best match
                            var best = null, bestScore = 0, bestIdx = -1;
                            for (var j = 0; j < modelNames.length; j++) {
                                var score = longestCommonSubstring(vName, modelNames[j]);
                                if (score > bestScore) { bestScore = score; best = modelNames[j]; bestIdx = j; }
                            }
                            if (best && bestScore > 0.2) {
                                vmd.motions[i].boneName = modelBones[bestIdx].name;
                            }
                        }
                    }
                    window.loader.MMDLoader.pourVmdIntoModel(window.model, vmd, "");
                    playAnimation();
                    self.message("动作已加载");
                },
                window.onProgress,
                function (err) {
                    self.message("加载失败");
                }
            );
        },
        selectDataPath: function() {
            this.dataPathEditingIndex = -1;
            this.dataPathForm = { path: this.settings.dataPath || '', category: '人物模型', tags: '' };
            this.dataPathDialogVisible = true;
        },
        editDataPath: function(idx) {
            this.dataPathEditingIndex = idx;
            var p = this.settings.dataPaths[idx];
            this.dataPathForm = {
                path: p.path,
                category: p.category || '人物模型',
                tags: (p.tags || []).join(', ')
            };
            this.dataPathDialogVisible = true;
        },
        dataPathDialogPickFolder: function() {
            var self = this;
            window.dialog.openDirectory(self.dataPathForm.path || '').then(function(result) {
                if (result) self.dataPathForm.path = result;
            });
        },
        confirmDataPath: function() {
            if (!this.dataPathForm.path) return;
            var paths = this.settings.dataPaths.slice();
            var entry = {
                path: this.dataPathForm.path,
                category: this.dataPathForm.category || '人物模型',
                tags: (this.dataPathForm.tags || '').split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; })
            };
            if (this.dataPathEditingIndex >= 0) {
                paths[this.dataPathEditingIndex] = entry;
            } else if (!paths.some(function(p) { return p.path === entry.path; })) {
                paths.push(entry);
            }
            this.settings = Object.assign({}, this.settings, { dataPaths: paths });
            this.dataPathDialogVisible = false;
        },
        removeDataPath: function(idx) {
            var paths = this.settings.dataPaths.slice();
            if (paths.length <= 1) {
                this.message('至少保留一个数据路径', 'warning');
                return;
            }
            paths.splice(idx, 1);
            this.settings = Object.assign({}, this.settings, { dataPaths: paths });
        },
        selectDefaultModel: function() {
            // Build list of all available models
            var self = this;
            var options = [];
            var data = this.$store.state.data;
            ['models', 'scenes'].forEach(function(k) {
                (data[k] || []).forEach(function(g) {
                    (g.models || []).forEach(function(mp) {
                        var name = window.path.basename(mp);
                        options.push({ label: name + ' (' + g.name + ')', value: mp });
                    });
                });
            });
            if (options.length === 0) {
                self.message('没有可用的模型');
                return;
            }
            // Use a simple selection via Element UI's $confirm with a select or just show a custom dialog
            // For simplicity, use a message box approach with a list
            var h = this.$createElement;
            var selectRef = null;
            var selected = self.settings.defaultModelPath || (options[0] && options[0].value);
            var vm = this.$msgbox({
                title: '选择默认模型',
                message: h('div', { style: 'min-width:400px' }, [
                    h('el-select', {
                        ref: 'sel',
                        props: { value: selected, filterable: true, placeholder: '搜索模型...' },
                        style: 'width:100%',
                        on: { input: function(v) { selected = v; } }
                    }, options.map(function(o) {
                        return h('el-option', { props: { key: o.value, label: o.label, value: o.value } });
                    }))
                ]),
                showCancelButton: true,
                confirmButtonText: '确定',
                beforeClose: function(action, instance, done) {
                    if (action === 'confirm') {
                        self.settings = Object.assign({}, self.settings, { defaultModelPath: selected });
                    }
                    done();
                }
            });
        },
        saveSettings: function() {
            var self = this;
            var dataJsonPath = PathManager.getDataFullPath();
            var existing = { important: self.important };
            if (fs.existsSync(dataJsonPath)) {
                try { existing = JSON.parse(fs.readFileSync(dataJsonPath).toString('utf8')); } catch(e) {}
            }
            var paths = self.settings.dataPaths || [];
            if (paths.length > 0) {
                self.settings.dataPath = paths[0].path;
            }
            existing.settings = self.settings;
            try {
                fs.writeFileSync(dataJsonPath, JSON.stringify(existing, null, 2));
                if (paths.length > 0) {
                }
                // Clean up items with non-monitored extensions
                self._cleanUnmonitoredItems();
                self._invalidateItemCategoryCache();
                self._bookmarkVersion = (self._bookmarkVersion || 0) + 1;
                self._reloadDataJson();
                self.$forceUpdate();
                self.message("配置已保存");
                setTimeout(function () { router.replace('/'); }, 500);
            } catch(e) {
                self.message("保存失败: " + e.message);
            }
        },
        resetSettings: function() {
            var defaults = {
                dataPath: '',
                dataPaths: [{ path: '', category: '人物模型', tags: [] }],
                availableExtensions: '.pmx,.pmd,.x,.vmd,.fx',
                defaultModelPath: '',
                mmdPath: '',
                preview: {
                    ambientColor: '#666666',
                    directionalColor: '#887766',
                    showAxis: true,
                    autoRotate: false,
                    cameraFov: 45,
                    cameraDistance: 30,
                    defaultModelMode: 'custom',
                    showSkybox: true,
                    skyboxMode: 'color',
                    skyboxImagePath: '',
                    skyColorTop: '#FFFFFF',
                    skyColorBottom: '#F0F0F0',
                    skyColorSide: '#FFFFFF',
                    thumbnailWidth: 48,
                    thumbnailHeight: 48,
                    gridThumbWidth: 128,
                    gridThumbHeight: 128,
                    viewMode: 'table'
                },
                render: {
                    ambientColor: '#666666',
                    directionalColor: '#887766',
                    showAxis: false,
                    autoRotate: false,
                    cameraFov: 45,
                    cameraDistance: 30,
                    showSkybox: true,
                    skyboxMode: 'color',
                    skyboxImagePath: '',
                    skyColorTop: '#FFFFFF',
                    skyColorBottom: '#F0F0F0',
                    skyColorSide: '#FFFFFF'
                }
            };
            this.settings = defaults;
            applyPreviewSettings();
            this.message("已恢复默认配置，保存后刷新生效");
        },
        applyPreview: function() {
            applyPreviewSettings();
        },
        selectSkyboxImage: function(target) {
            var self = this;
            target = target || 'preview';
            var cfg = self.settings[target] || self.settings.preview;
            var currentPath = cfg.skyboxImagePath || '';
            window.dialog.openDirectory(currentPath).then(function(result) {
                if (result) {
                    var update = {};
                    update[target] = Object.assign({}, self.settings[target] || {}, { skyboxImagePath: result });
                    self.settings = Object.assign({}, self.settings, update);
                    if (target === 'preview') applyPreviewSettings();
                }
            });
        },
        selectMmdPath: function() {
            var self = this;
            var currentPath = self.settings.mmdPath || '';
            window.dialog.openFile(currentPath, [{ name: '可执行文件', extensions: ['exe'] }]).then(function(result) {
                if (result) {
                    self.settings = Object.assign({}, self.settings, { mmdPath: result });
                }
            });
        },
        exportToMmd: function(modelPath) {
            var self = this;
            var mmdPath = self.settings.mmdPath;
            if (!mmdPath) {
                self.message("请先在设置中配置 MMD 软件路径");
                return;
            }
            window.exportToMmd({ mmdPath: mmdPath, modelPath: modelPath }).then(function(res) {
                if (res.success) {
                    self.message("已发送到 MMD 软件");
                } else {
                    self.message("启动失败: " + (res.error || "未知错误"));
                }
            });
        },
        exportVmdToMmd: function(vmdPath) {
            var self = this;
            var mmdPath = self.settings.mmdPath;
            if (!mmdPath) {
                self.message("请先在设置中配置 MMD 软件路径");
                return;
            }
            // Use currently loaded model, or default model from settings
            var modelPath = window.model ? window.model.userData.modelPath : null;
            if (!modelPath) {
                modelPath = self.settings.defaultModelPath;
            }
            if (!modelPath) {
                self.message("请先加载一个模型，或在设置中配置默认模型路径");
                return;
            }
            window.exportToMmd({ mmdPath: mmdPath, modelPath: modelPath, vmdPath: vmdPath }).then(function(res) {
                if (res.success) {
                    self.message("已发送到 MMD 软件");
                } else {
                    self.message("启动失败: " + (res.error || "未知错误"));
                }
            });
        },
        _getPreviewPath: function(modelPath) {
            var dir = window.path.dirname(modelPath);
            var base = window.path.basename(modelPath);
            var name = base.replace(/\.[^.]+$/, ''); // strip extension
            return dir + path.sep + name + '.png';
        },
        _capturePreviewAfterLoad: function(modelPath) {
            var previewPath = this._getPreviewPath(modelPath);
            var self = this;
            // Wait for textures to finish loading, then capture
            setTimeout(function() {
                window.fs.exists(previewPath, function(exists) {
                    if (exists) return;
                    var dataUrl = window.capturePreview && window.capturePreview();
                    if (dataUrl && window.savePreviewImage) {
                        window.savePreviewImage(previewPath, dataUrl);
                        // Invalidate cache so hasPreview returns true next time
                        self['__prev_' + modelPath] = true;
                    }
                });
            }, 2500);
        },
        hasPreview: function(modelPath) {
            if (!modelPath) return false;
            var key = '__prev_' + modelPath;
            if (this[key] !== undefined) return this[key];
            try {
                this[key] = window.fs.existsSync(this._getPreviewPath(modelPath));
            } catch(e) {
                this[key] = false;
            }
            return this[key];
        },
        previewSrc: function(modelPath) {
            if (!modelPath) return '';
            return this._getPreviewPath(modelPath) + '?t=' + Date.now();
        },
        toggleDevTools: function() {
            window.toggleDevTools && window.toggleDevTools();
        },
        // Category management
        addCategory: function() {
            this.categoryDialogTitle = '添加种类';
            this.categoryForm = { name: '', extensions: [], parent: '' };
            this.categoryEditIndex = -1;
            this.categoryDialogVisible = true;
        },
        editCategoryNode: function(data) {
            this.categoryDialogTitle = '编辑种类';
            this.categoryForm = {
                name: data.name,
                extensions: (data.extensions || '').split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e; }),
                parent: data.parent || ''
            };
            this.categoryEditIndex = this.categories.findIndex(function(c) { return c.name === data.name; });
            this.categoryDialogVisible = true;
        },
        deleteCategoryNode: function(data) {
            var self = this;
            this.$confirm('确定删除种类 "' + data.name + '"？子种类也会被删除。', '提示', { type: 'warning' }).then(function() {
                var cats = self.settings.categories.slice().filter(function(c) {
                    return c.name !== data.name && c.parent !== data.name;
                });
                self.settings = Object.assign({}, self.settings, { categories: cats });
            }).catch(function() {});
        },
        saveCategory: function() {
            var cats = this.settings.categories.slice();
            var f = this.categoryForm;
            var exts = Array.isArray(f.extensions) ? f.extensions.join(',') : f.extensions;
            if (!f.name || !exts) { this.message('名称和后缀不能为空', 'warning'); return; }
            var entry = { name: f.name, extensions: exts, parent: f.parent || '' };
            if (this.categoryEditIndex >= 0) {
                cats.splice(this.categoryEditIndex, 1, entry);
            } else {
                cats.push(entry);
            }
            this.settings = Object.assign({}, this.settings, { categories: cats });
            this.categoryDialogVisible = false;
        },
        getCategoryData: function(cat) {
            var raw = [];
            if (!cat || !cat.name) {
                // No category selected — merge all data
                var data = this.$store.state.data;
                for (var k in data) {
                    if (k === 'project') continue;
                    if (Array.isArray(data[k])) raw = raw.concat(data[k]);
                }
            } else {
                var key = this.categoryDataMap[cat.name] || cat.name;
                raw = this.$store.state.data[key] || [];
            }
            // Apply active filters
            return this.applyFilters(raw);
        },
        _reloadDataJson: function() {
            window._reloadDataJson();
        },
        forceRescan: function() {
            var self = this;
            var known = {};
            var dataJsonPath = PathManager.getDataFullPath();
            try {
                var raw = JSON.parse(fs.readFileSync(dataJsonPath).toString('utf8'));
                (raw.items || []).forEach(function(i) { known[i.path] = i.category; });
            } catch(e) {}
            var allowedExts2 = {};
            (self.monitoredExtensions || '.pmx,.pmd').split(',').forEach(function(e) { e = e.trim().toLowerCase(); if (e) allowedExts2[e] = true; });
            var newFiles = [];
            function scanDir(dir) {
                if (!fs.existsSync(dir)) return;
                var entries = fs.readdirSync(dir);
                entries.forEach(function(f) {
                    var fp = dir + '/' + f;
                    var st;
                    try { st = fs.lstatSync(fp); } catch(e) { return; }
                    if (st.isDirectory) { scanDir(fp); }
                    else {
                        var ext = window.path.extname(f).toLowerCase();
                        if (allowedExts2[ext] && !known[fp]) {
                            // Find default category/tags from matching path
                            var dCat = '人物模型', dTags = [];
                            (self.settings.dataPaths || []).forEach(function(dp2) {
                                if (fp.indexOf(dp2.path) === 0) { dCat = dp2.category || '人物模型'; dTags = dp2.tags || []; }
                            });
                            newFiles.push({ src: fp, name: f, defaultCategory: dCat, defaultTags: dTags });
                        }
                    }
                });
            }
            // Scan all configured paths
            var dataPaths = self.settings.dataPaths || [];
            if (dataPaths.length === 0) dataPaths = [{ path: '', category: '人物模型', tags: [] }];
            var scannedRoots = {};
            dataPaths.forEach(function(dpEntry) {
                var root = dpEntry.path;
                if (scannedRoots[root]) return;
                scannedRoots[root] = true;
                scanDir(root);
            });
            if (newFiles.length > 0 && window.showBatchClassifyDialog) {
                window.showBatchClassifyDialog(newFiles, function(choices, tagChoices) {
                    newFiles.forEach(function(f) {
                        var tags = (tagChoices && tagChoices[f.src]) || f.defaultTags || [];
                        window._addItemToDataJson({ path: f.src, category: choices[f.src] || f.defaultCategory || '人物模型', group: window.path.basename(window.path.dirname(f.src)), tags: tags });
                    });
                    self._invalidateItemCategoryCache();
                    self._bookmarkVersion = (self._bookmarkVersion || 0) + 1;
                    window._reloadDataJson();
                    self.$forceUpdate();
                    self.message("已添加 " + newFiles.length + " 个新文件");
                    setTimeout(function() { router.replace('/'); }, 500);
                });
            } else {
                self._invalidateItemCategoryCache();
                self._bookmarkVersion = (self._bookmarkVersion || 0) + 1;
                window._reloadDataJson();
                self.$forceUpdate();
                self.message(newFiles.length === 0 ? "没有新文件" : "数据已刷新");
                if (newFiles.length === 0) setTimeout(function() { router.replace('/'); }, 500);
            }
        },
        forceRescanAll: function() {
            var self = this;
            var dp = PathManager.getDataFullPath();
            var data = {};
            try { data = JSON.parse(fs.readFileSync(dp).toString('utf8')); } catch(e) {}
            if (!data.items) data.items = [];
            var known = {};
            data.items.forEach(function(i) { known[i.path] = true; });
            var allFiles = [];
            function scanDir(dir, allowed) {
                if (!fs.existsSync(dir)) return;
                var entries = fs.readdirSync(dir);
                entries.forEach(function(f) {
                    var fp = dir + '/' + f;
                    var st;
                    try { st = fs.lstatSync(fp); } catch(e) { return; }
                    if (st.isDirectory) { scanDir(fp, allowed); }
                    else {
                        var ext = window.path.extname(f).toLowerCase();
                        if (allowed[ext]) {
                            allFiles.push({ src: fp, name: f });
                        }
                    }
                });
            }
            var dataPaths = self.settings.dataPaths || [];
            if (dataPaths.length === 0) dataPaths = [{ path: '', category: '人物模型', tags: [] }];
            var scannedRoots = {};
            dataPaths.forEach(function(dpEntry) {
                if (scannedRoots[dpEntry.path]) return;
                scannedRoots[dpEntry.path] = true;
                // Build allowed extensions from this path's default category
                var catCfg = (self.settings.categories || []).find(function(c) { return c.name === (dpEntry.category || '人物模型'); });
                var exts = catCfg ? (catCfg.extensions || '.pmx,.pmd') : '.pmx,.pmd';
                var allowed = {};
                exts.split(',').forEach(function(e) { e = e.trim().toLowerCase(); if (e) allowed[e] = true; });
                scanDir(dpEntry.path, allowed);
            });
            data.items = data.items.filter(function(i) { return fs.existsSync(i.path); });
            // Build classify items with pre-assigned defaults
            var classifyItems = [];
            var defaultChoices = {};
            allFiles.forEach(function(f) {
                var defCat = '人物模型';
                var defTags = [];
                (self.settings.dataPaths || []).forEach(function(dp2) {
                    if (f.src.indexOf(dp2.path) === 0) {
                        defCat = dp2.category || '人物模型';
                        defTags = dp2.tags || [];
                    }
                });
                classifyItems.push({ src: f.src, name: f.name, defaultCategory: defCat, defaultTags: defTags });
                defaultChoices[f.src] = defCat;
            });
            if (classifyItems.length > 0 && window.showBatchClassifyDialog) {
                window.showBatchClassifyDialog(classifyItems, function(choices, tagChoices) {
                    allFiles.forEach(function(f) {
                        var cat = choices[f.src] || defaultChoices[f.src] || '人物模型';
                        var tags = (tagChoices && tagChoices[f.src]) || [];
                        var existingItem = data.items.find(function(i) { return i.path === f.src; });
                        if (existingItem) {
                            existingItem.category = cat;
                            existingItem.tags = tags.slice();
                            existingItem.group = window.path.basename(window.path.dirname(f.src));
                        } else {
                            data.items.push({ path: f.src, category: cat, group: window.path.basename(window.path.dirname(f.src)), tags: tags.slice() });
                        }
                    });
                    data.settings = self.settings;
                    fs.writeFileSync(dp, JSON.stringify(data, null, 2));
                    self._cleanUnmonitoredItems();
                    window._reloadDataJson();
                    self._invalidateItemCategoryCache();
                    self._bookmarkVersion = (self._bookmarkVersion || 0) + 1;
                    self.$forceUpdate();
                    self.message('已重新扫描 ' + allFiles.length + ' 个文件');
                    setTimeout(function() { router.replace('/'); }, 500);
                });
            } else {
                data.settings = self.settings;
                fs.writeFileSync(dp, JSON.stringify(data, null, 2));
                self._cleanUnmonitoredItems();
                window._reloadDataJson();
                self.message('已重新扫描 ' + allFiles.length + ' 个文件');
                setTimeout(function() { router.replace('/'); }, 500);
            }
        },
        generatePreviewsForPaths: function(modelPaths) {
            var self = this;
            if (!modelPaths || modelPaths.length === 0) {
                self.message('没有需要生成预览的模型');
                return;
            }
            var total = modelPaths.length;
            window.updateImportProgress({ visible: true, total: total, done: 0, text: '正在生成预览...' });
            var queue = modelPaths.slice();
            var doneCount = 0;
            function next() {
                if (queue.length === 0) {
                    window.updateImportProgress({ visible: false });
                    self._invalidatePreviewCache();
                    self.message('预览已生成 (' + total + ' 个)');
                    setTimeout(function() { router.replace('/'); }, 500);
                    return;
                }
                var mp = queue.shift();
                window.updateImportProgress({
                    text: '预览 (' + (doneCount + 1) + '/' + total + ')',
                    detail: window.path.basename(mp),
                    done: doneCount
                });
                window.captureSinglePreview(mp).then(function () {
                    doneCount++;
                    window.updateImportProgress({ done: doneCount });
                    next();
                });
            }
            next();
        },
        forceRegeneratePreviews: function() {
            var self = this;
            // Collect all model files from current data
            var allModels = [];
            var data = this.$store.state.data;
            ['models', 'scenes'].forEach(function (key) {
                (data[key] || []).forEach(function (group) {
                    (group.models || []).forEach(function (mp) {
                        var ext = window.path.extname(mp).toLowerCase();
                        var allowedPreviews = getMonitoredExtensionsSet();
                        if (allowedPreviews[ext]) {
                            allModels.push(mp);
                        }
                    });
                });
            });
            if (allModels.length === 0) {
                self.message('没有可生成预览的模型文件');
                return;
            }
            // Force regenerate all previews, ignoring whether they already exist
            var total = allModels.length;
            window.updateImportProgress({ visible: true, total: total, done: 0, text: '正在强制生成所有预览...' });
            var queue = allModels.slice();
            var doneCount = 0;
            function next() {
                if (queue.length === 0) {
                    window.updateImportProgress({ visible: false });
                    self._invalidatePreviewCache();
                    self.message('全部预览已重新生成 (' + total + ' 个)');
                    setTimeout(function() { router.replace('/'); }, 500);
                    return;
                }
                var mp = queue.shift();
                window.updateImportProgress({
                    text: '正在生成预览 (' + (doneCount + 1) + '/' + total + ')',
                    detail: window.path.basename(mp),
                    done: doneCount
                });
                window.captureSinglePreview(mp).then(function () {
                    doneCount++;
                    window.updateImportProgress({ done: doneCount });
                    // Wait for current capture to fully complete before starting next
                    next();
                });
            }
            next();
        },
        _getItemCategory: function(mp) {
            var entry = (this.$store.state.itemIndex || {})[mp];
            return (entry && entry.category) || '';
        },
        _derivedCategoryMap: function() {
            // path → category derived from the store grouping itself, for items
            // whose data.json entry carries no category. Cached per (data, settings)
            // snapshot so filtering stays O(1) per model.
            var data = this.$store.state.data;
            var settings = this.$store.state.settings;
            var cached = this._derivedCategoryCache;
            if (cached && cached.data === data && cached.settings === settings) return cached.map;
            var cats = this.categories;
            var keyMap = this.categoryDataMap;
            var map = {};
            for (var k in data) {
                if (!Array.isArray(data[k])) continue;
                var groups = data[k];
                for (var gi = 0; gi < groups.length; gi++) {
                    var g = groups[gi];
                    var models = g.models || [];
                    // Same preference as the old per-path scan: group name matching a
                    // category first, then the category owning this store key; the first
                    // group (store-key order) containing a path wins, even on a '' result
                    var byName = '';
                    for (var ci = 0; ci < cats.length; ci++) {
                        if (cats[ci].name === g.name) { byName = cats[ci].name; break; }
                    }
                    if (!byName) {
                        for (var cj = 0; cj < cats.length; cj++) {
                            if ((keyMap[cats[cj].name] || cats[cj].name) === k) { byName = cats[cj].name; break; }
                        }
                    }
                    for (var mi = 0; mi < models.length; mi++) {
                        if (map[models[mi]] === undefined) map[models[mi]] = byName;
                    }
                }
            }
            this._derivedCategoryCache = { data: data, settings: settings, map: map };
            return map;
        },
        _deriveCategoryFromStore: function(mp) {
            return this._derivedCategoryMap()[mp] || '';
        },
        _getCategoryPath: function(name) {
            // Build full path like "人物模型 > 子分类"
            var parts = [name];
            var cats = this.categories || [];
            var current = name;
            while (current) {
                var parent = null;
                for (var i = 0; i < cats.length; i++) {
                    if (cats[i].name === current) { parent = cats[i].parent; break; }
                }
                if (parent) { parts.unshift(parent); current = parent; }
                else { current = null; }
            }
            return parts.join(' > ');
        },
        _isCategoryDescendant: function(catName, ancestorName) {
            if (!catName || !ancestorName) return false;
            var cats = this.categories || [];
            var current = catName;
            while (current) {
                if (current === ancestorName) return true;
                var found = false;
                for (var i = 0; i < cats.length; i++) {
                    if (cats[i].name === current && cats[i].parent) {
                        current = cats[i].parent;
                        found = true;
                        break;
                    }
                }
                if (!found) break;
            }
            return false;
        },
        _cleanUnmonitoredItems: function() {
            var allowed = {};
            var scanExts = (this.monitoredExtensions || '.pmx,.pmd').split(',').filter(function(e) { return e; });
            scanExts.forEach(function(e) { e = e.trim().toLowerCase(); if (e) allowed[e] = true; });
            var dp = PathManager.getDataFullPath();
            try {
                var raw = JSON.parse(fs.readFileSync(dp).toString('utf8'));
                var before = (raw.items || []).length;
                raw.items = (raw.items || []).filter(function(i) {
                    var ext = window.path.extname(i.path).toLowerCase();
                    return allowed[ext] && fs.existsSync(i.path);
                });
                if (raw.items.length < before) {
                    fs.writeFileSync(dp, JSON.stringify(raw, null, 2));
                }
            } catch(e) {}
        },
        _invalidateItemCategoryCache: function() {
            // Rebuild the item index from data.json after a direct write;
            // on read failure the previous index is kept rather than emptied
            try {
                var raw = JSON.parse(fs.readFileSync(PathManager.getDataFullPath()).toString('utf8'));
                window._buildItemIndex(raw);
            } catch(e) {}
        },
        _invalidatePreviewCache: function() {
            // Clear hasPreview cache entries
            for (var key in this) {
                if (key.indexOf('__prev_') === 0) {
                    delete this[key];
                }
            }
        },
        message: function (info, type) {
            showNotify(info, type || 'info');
        },
    },
    mounted: function() {
        window._previewModel = this.updateModel.bind(this);
        window._regeneratePreviews = this.forceRegeneratePreviews.bind(this);
        window._generatePreviewsForPaths = this.generatePreviewsForPaths.bind(this);
    },
};
// Global helper for main.js to call.
// Callers own the refresh timing (the import dialog calls window._reloadDataJson itself),
// so this must not reload on its own or every imported item triggers a full reload.
window._addItemToDataJson = function(item) {
    var dp = PathManager.getDataFullPath();
    try {
        var raw = JSON.parse(fs.readFileSync(dp).toString('utf8'));
        if (!raw.items) raw.items = [];
        if (!raw.items.some(function(i) { return i.path === item.path && i.category === item.category; })) {
            raw.items.push(item);
            fs.writeFileSync(dp, JSON.stringify(raw, null, 2));
            // Patch the item index in place — called in loops during import,
            // so a full index rebuild here would re-read data.json per item
            Vue.set(window.store.state.itemIndex, item.path,
                { category: item.category || '', bookmarked: !!item.bookmarked, nsfw: !!item.nsfw });
        }
    } catch(e) { console.error(e); }
};

// Build the in-memory item index (path → { category, bookmarked, nsfw }) from a
// parsed data.json. gridItems / applyFilters read this instead of hitting the disk.
window._buildItemIndex = function(raw) {
    var idx = {};
    ((raw && raw.items) || []).forEach(function(i) {
        if (!i || !i.path) return;
        idx[i.path] = { category: i.category || '', bookmarked: !!i.bookmarked, nsfw: !!i.nsfw };
    });
    window.store.state.itemIndex = idx;
};
window._reloadDataJson = function() {
    var dp = PathManager.getDataFullPath();
    try {
        var raw = JSON.parse(fs.readFileSync(dp).toString('utf8'));
        window.store.state.important = raw.important || [];
        var items = raw.items || [];
        var data = { models: [], scenes: [], vmds: [], mmes: [], project: [] };
        var catMap = { '人物模型': 'models', '场景模型': 'scenes', '动作文件': 'vmds', 'MME特效': 'mmes' };
        (raw.settings && raw.settings.categories || []).forEach(function(c) {
            if (!catMap[c.name]) catMap[c.name] = c.type === 'motion' ? 'vmds' : c.type === 'effect' ? 'mmes' : 'models';
        });
        var groups = {};
        items.forEach(function(item) {
            var k = catMap[item.category] || 'models';
            var gn = item.group || window.path.basename(item.path).replace(/\.[^.]+$/, '');
            var gk = k + '|' + gn;
            if (!groups[gk]) { groups[gk] = { id: Object.keys(groups).length, name: gn, address: window.path.dirname(item.path) + '/', models: [], vmds: [], img: 'yes', type: 'no', info: { tags: [] } }; data[k].push(groups[gk]); }
            if (window.path.extname(item.path).toLowerCase() === '.vmd') groups[gk].vmds.push(item.path);
            else groups[gk].models.push(item.path);
            // Aggregate per-item tags to group level
            if (item.tags && item.tags.length > 0) {
                var gInfo = groups[gk].info;
                if (!gInfo.tags) gInfo.tags = [];
                item.tags.forEach(function(t) {
                    if (gInfo.tags.indexOf(t) < 0) gInfo.tags.push(t);
                });
                groups[gk].type = 'yes';
            }
        });
        window.store.state.data = data;
        window._buildItemIndex(raw);
    } catch(e) { console.error(e); }
};

// Capture preview for a single model (load → render → screenshot → cleanup)
window.captureSinglePreview = function(modelPath) {
    return new Promise(function(resolve) {
        var previewPath = window.path.dirname(modelPath) + window.path.sep +
            window.path.basename(modelPath).replace(/\.[^.]+$/, '') + '.png';
        // Remove all existing models to avoid conflicts
        if (window.model) { window.scene.remove(window.model); clearCache(window.model); window.model = null; }
        if (window.sceneModel) { window.scene.remove(window.sceneModel); clearCache(window.sceneModel); window.sceneModel = null; }
        var captured = false;
        function doCapture() {
            if (captured) return;
            captured = true;
            setTimeout(function() {
                window.resetCamera && window.resetCamera();
                var renderSettings = (window.store && window.store.state.settings && window.store.state.settings.render) || { autoRotate: false, showAxis: false };
                if (!renderSettings.autoRotate) renderSettings.autoRotate = false;
                window.applyPreviewSettings && window.applyPreviewSettings(renderSettings);
                if (window.model) {
                    var dataUrl = window.capturePreview && window.capturePreview();
                    if (dataUrl && window.savePreviewImage) {
                        window.savePreviewImage(previewPath, dataUrl);
                    }
                }
                window.applyPreviewSettings && window.applyPreviewSettings();
                if (window.model) { var m = window.model; window.scene.remove(m); clearCache(m); window.model = null; }
                if (window.sceneModel) { var s = window.sceneModel; window.scene.remove(s); clearCache(s); window.sceneModel = null; }
                resolve();
            }, 5000);
        }
        window.loader.MMDLoader.loadModel(
            modelPath,
            function(mmd) {
                window.model = mmd;
                mmd.userData.modelPath = modelPath;
                window.scene.add(mmd);
                setupModel(mmd, false);
                doCapture();
            },
            window.onProgress,
            function(err) {
                // Even on texture error, mesh may have loaded. Always try capture.
                doCapture();
            }
        );
    });
};

// Auto-load all models in a folder for preview capture (background).
// onProgress(name, step, idx, total) called for each model.
// Returns a Promise that resolves when all captures are done.
window.autoPreviewImport = function(folderPath, onProgress) {
    onProgress = onProgress || function(){};
    return new Promise(function(resolveAll) {
        try {
            var files = window.fs.readdirSync(folderPath);
            var modelFiles = [];
            for (var i = 0; i < files.length; i++) {
                var ext = window.path.extname(files[i]).toLowerCase();
                var allowedPreviews2 = getMonitoredExtensionsSet();
                if (allowedPreviews2[ext]) {
                    modelFiles.push(folderPath + '/' + files[i]);
                }
            }
            if (modelFiles.length === 0) { resolveAll(); return; }

            // Remove all existing models
            if (window.model) { window.scene.remove(window.model); clearCache(window.model); window.model = null; }
            if (window.sceneModel) { window.scene.remove(window.sceneModel); clearCache(window.sceneModel); window.sceneModel = null; }

            var idx = 0;
            var total = modelFiles.length;
            function processNext() {
                if (idx >= modelFiles.length) { resolveAll(); return; }
                var modelPath = modelFiles[idx];
                var modelName = window.path.basename(modelPath);
                var curIdx = idx + 1;
                idx++;
                onProgress(modelName, '加载中...', curIdx, total);
                window.loader.MMDLoader.loadModel(
                    modelPath,
                    function(mmd) {
                        window.model = mmd;
                        mmd.userData.modelPath = modelPath;
                        window.scene.add(mmd);
                        setupModel(mmd, false);
                        onProgress(modelName, '渲染截图...', curIdx, total);
                        var previewPath = window.path.dirname(modelPath) + window.path.sep +
                            window.path.basename(modelPath).replace(/\.[^.]+$/, '') + '.png';
                        setTimeout(function() {
                            window.resetCamera && window.resetCamera();
                            var renderSettings = (window.store && window.store.state.settings && window.store.state.settings.render) || { autoRotate: false, showAxis: false };
                            if (!renderSettings.autoRotate) renderSettings.autoRotate = false;
                            window.applyPreviewSettings && window.applyPreviewSettings(renderSettings);
                            var dataUrl = window.capturePreview && window.capturePreview();
                            if (dataUrl && window.savePreviewImage) {
                                window.savePreviewImage(previewPath, dataUrl);
                            }
                            window.applyPreviewSettings && window.applyPreviewSettings();
                            onProgress(modelName, '完成', curIdx, total);
                            window.scene.remove(mmd);
                            clearCache(mmd);
                            window.model = null;
                            processNext();
                        }, 5000);
                    },
                    window.onProgress,
                    function() { onProgress(modelName, '失败', curIdx, total); processNext(); }
                );
            }
            processNext();
        } catch(e) {
            console.error('[autoPreview] Error:', e);
            resolveAll();
        }
    });
};

window.routes = [
    { path: "/", component: componentInit },
    { path: "/index", component: componentIndex },
];
