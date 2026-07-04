const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const pathMod = require('path');
const processMod = require('process');

// App root directory for data storage
// Windows: %APPDATA%/mmdmanager, macOS: ~/.config/mmdmanager
function getDefaultDataPath() {
    if (process.platform === 'win32') {
        return pathMod.join(process.env.APPDATA, 'mmdmanager');
    } else {
        return pathMod.join(process.env.HOME, '.config', 'mmdmanager');
    }
}
const isPackaged = __dirname.indexOf('.asar') !== -1;
const CONFIGPATH = getDefaultDataPath();
let PROGRAMPATH;
if (isPackaged) {
    if (process.platform === 'win32') {
        PROGRAMPATH = CONFIGPATH;
    } else {
        PROGRAMPATH = pathMod.dirname(process.execPath);
    }
} else {
    PROGRAMPATH = __dirname;
}

// Wrap stat objects to convert methods to plain boolean properties
function wrapStats(stats) {
    return {
        dev: stats.dev,
        ino: stats.ino,
        mode: stats.mode,
        nlink: stats.nlink,
        uid: stats.uid,
        gid: stats.gid,
        rdev: stats.rdev,
        size: stats.size,
        blksize: stats.blksize,
        blocks: stats.blocks,
        atimeMs: stats.atimeMs,
        mtimeMs: stats.mtimeMs,
        ctimeMs: stats.ctimeMs,
        birthtimeMs: stats.birthtimeMs,
        atime: stats.atime,
        mtime: stats.mtime,
        ctime: stats.ctime,
        birthtime: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isBlockDevice: stats.isBlockDevice(),
        isCharacterDevice: stats.isCharacterDevice(),
        isSymbolicLink: stats.isSymbolicLink(),
        isFIFO: stats.isFIFO(),
        isSocket: stats.isSocket()
    };
}

contextBridge.exposeInMainWorld('PROGRAMPATH', PROGRAMPATH);
contextBridge.exposeInMainWorld('CONFIGPATH', CONFIGPATH);

contextBridge.exposeInMainWorld('fs', {
    readFile: (filePath, options, callback) => {
        if (typeof options === 'function') {
            callback = options;
            options = undefined;
        }
        return fs.readFile(filePath, options || 'utf8', function(err, data) {
            if (err) return callback(err);
            if (typeof data === 'string') return callback(null, data);
            callback(null, Buffer.isBuffer(data) ? data.toString('utf8') : data);
        });
    },
    readFileSync: (filePath, options) => {
        var data = fs.readFileSync(filePath, options);
        if (typeof data === 'string') return data;
        return Buffer.isBuffer(data) ? data.toString('utf8') : data;
    },
    writeFile: (filePath, data, callback) => {
        return fs.writeFile(filePath, data, callback);
    },
    writeFileSync: (filePath, data, options) => {
        return fs.writeFileSync(filePath, data, options);
    },
    exists: (filePath, callback) => {
        return fs.exists(filePath, callback);
    },
    existsSync: (filePath) => {
        return fs.existsSync(filePath);
    },
    readdirSync: (dirPath) => {
        return fs.readdirSync(dirPath);
    },
    mkdirSync: (dirPath, options) => {
        return fs.mkdirSync(dirPath, options || { recursive: true });
    },
    statSync: (filePath) => {
        const s = fs.statSync(filePath);
        return wrapStats(s);
    },
    lstatSync: (filePath) => {
        const s = fs.lstatSync(filePath);
        return wrapStats(s);
    }
});

contextBridge.exposeInMainWorld('path', {
    extname: (p) => pathMod.extname(p),
    basename: (p) => pathMod.basename(p),
    dirname: (p) => pathMod.dirname(p),
    join: (...args) => pathMod.join(...args),
    sep: pathMod.sep
});

contextBridge.exposeInMainWorld('process', {
    platform: processMod.platform,
    env: processMod.env
});

contextBridge.exposeInMainWorld('child_process', {
    exec: (command, options, callback) => {
        // exec is only used in the old code — delegate to main for cross-platform support
        return ipcRenderer.invoke('child-process:exec', { command, options });
    },
    spawn: (exePath, args, options) => {
        return ipcRenderer.invoke('child-process:spawn', { exePath, args, options });
    }
});

contextBridge.exposeInMainWorld('dialog', {
    openDirectory: (defaultPath) => ipcRenderer.invoke('dialog:openDirectory', defaultPath),
    openFile: (defaultPath, filters) => ipcRenderer.invoke('dialog:openFile', { defaultPath, filters })
});

contextBridge.exposeInMainWorld('clipboard', {
    writeText: (text) => ipcRenderer.invoke('clipboard:write', text)
});

contextBridge.exposeInMainWorld('shell', {
    openPath: (folderPath) => ipcRenderer.invoke('shell:openPath', folderPath)
});

contextBridge.exposeInMainWorld('exportToMmd', (opts) => {
    return ipcRenderer.invoke('export:toMmd', opts);
});

contextBridge.exposeInMainWorld('copyFolder', (src, dest) => {
    return ipcRenderer.invoke('fs:copyFolder', { src, dest });
});
contextBridge.exposeInMainWorld('extractZip', (zipPath, destDir) => {
    return ipcRenderer.invoke('fs:extractZip', { zipPath, destDir });
});


contextBridge.exposeInMainWorld('savePreviewImage', (filePath, base64Data) => {
    var raw = base64Data.replace(/^data:image\/png;base64,/, '');
    var buffer = Buffer.from(raw, 'base64');
    fs.writeFileSync(filePath, buffer);
});

contextBridge.exposeInMainWorld('toggleDevTools', () => {
    return ipcRenderer.invoke('devtools:toggle');
});

// Drag-out: start native file drag when dragging app elements
document.addEventListener('dragstart', function(e) {
    var filePath = e.target.dataset && e.target.dataset.filepath;
    if (!filePath) {
        // Check parent (for popover-wrapped buttons)
        var parent = e.target.closest('[data-filepath]');
        if (parent) filePath = parent.dataset.filepath;
    }
    if (filePath) {
        e.preventDefault();
        ipcRenderer.send('drag:start', filePath);
    }
});


// Intercept file drops — File.path works on Windows but not macOS.
// On macOS we read via webkitGetAsEntry and write to a temp directory.
document.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
});
document.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var files = e.dataTransfer.files;
    var items = e.dataTransfer.items;
    if (!files || files.length === 0) return;

    // Windows / Linux: File.path works — collect all paths
    if (files[0].path) {
        var paths = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i].path) paths.push(files[i].path);
        }
        if (paths.length === 1) {
            window.postMessage({ type: 'file:drop', path: paths[0] }, '*');
        } else {
            window.postMessage({ type: 'file:batch-drop', paths: paths, total: paths.length }, '*');
        }
        return;
    }

    // macOS: webkitGetAsEntry tree walk for all items
    if (!items || items.length === 0) return;

    var allPending = [];

    function copyEntry(ent, targetDir) {
        if (ent.isFile) {
            return new Promise(function (resolve, reject) {
                ent.file(function (file) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        try {
                            fs.writeFileSync(pathMod.join(targetDir, file.name), Buffer.from(reader.result));
                            resolve();
                        } catch (err) { reject(err); }
                    };
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(file);
                });
            });
        } else if (ent.isDirectory) {
            var subDir = pathMod.join(targetDir, ent.name);
            fs.mkdirSync(subDir, { recursive: true });
            var dirReader = ent.createReader();
            return new Promise(function (resolve) {
                var childPromises = [];
                function readBatch() {
                    dirReader.readEntries(function (entries) {
                        if (entries.length === 0) {
                            Promise.all(childPromises).then(resolve);
                            return;
                        }
                        for (var i = 0; i < entries.length; i++) {
                            childPromises.push(copyEntry(entries[i], subDir));
                        }
                        readBatch();
                    });
                }
                readBatch();
            });
        }
    }

    function processEntry(entry) {
        return new Promise(function(resolveEntry) {
            var folderName = entry.name;
            if (entry.isFile) {
                folderName = entry.name.replace(/\.[^.]+$/, '');
            }
            var destDir = pathMod.join(PROGRAMPATH, '.temp', folderName);
            try { fs.rmSync(destDir, { recursive: true, force: true }); } catch (_) {}
            fs.mkdirSync(destDir, { recursive: true });

            var pending = [];
            if (entry.isFile) {
                pending.push(copyEntry(entry, destDir));
            } else {
                pending.push(new Promise(function (resolve) {
                    var childPromises = [];
                    var dirReader = entry.createReader();
                    function readBatch() {
                        dirReader.readEntries(function (entries) {
                            if (entries.length === 0) {
                                Promise.all(childPromises).then(resolve);
                                return;
                            }
                            for (var i = 0; i < entries.length; i++) {
                                childPromises.push(copyEntry(entries[i], destDir));
                            }
                            readBatch();
                        });
                    }
                    readBatch();
                }));
            }
            Promise.all(pending).then(function () {
                resolveEntry(destDir);
            }).catch(function (err) {
                console.error('[preload] copy error:', err);
                resolveEntry(null);
            });
        });
    }

    // Process all dropped items in parallel
    for (var i = 0; i < items.length; i++) {
        var entry = items[i].webkitGetAsEntry();
        if (entry) allPending.push(processEntry(entry));
    }

    Promise.all(allPending).then(function (results) {
        var paths = results.filter(Boolean);
        if (paths.length === 0) return;
        if (paths.length === 1) {
            window.postMessage({ type: 'file:drop', path: paths[0] }, '*');
        } else {
            window.postMessage({ type: 'file:batch-drop', paths: paths, total: paths.length }, '*');
        }
    });
});
