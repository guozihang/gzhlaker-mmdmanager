/*----------------------------------------------------
# ● 默认配置的唯一来源
# model.js 的 Vuex 初始 state、components.js 的
# migrateConfig() / resetSettings() 均从此处派生。
# 需在 js/model.js 之前加载。
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
            mmdPath: '',
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
