function PathManager() {
    throw new Error('This is a static class');
}
PathManager.dataFileName = 'data.json'
PathManager.CONFIGPATH = window.CONFIGPATH || window.PROGRAMPATH;
PathManager.getDataFullPath = function(){
    return PathManager.CONFIGPATH + path.sep + PathManager.dataFileName;
}
