var loadingLog = function(){};
var clock = new THREE.Clock();
var container;
var renderer;
var camera;
var scene;
var loader = {};
var light = [];
var model;         // character model (VMD target)
var sceneModel;    // scene/environment model
var control;
var effect;
var mmdHelper;

function initCamera() {
    var target = document.getElementById("modelTarget");
    var w = target.clientWidth || 800;
    var h = Math.min(w * 0.75, 600);
    var p = getPreview();
    var fov = p.cameraFov || 45;
    var dist = p.cameraDistance || 30;
    camera = new THREE.PerspectiveCamera(fov, w / h, 1, 2000);
    camera.position.y = 10;
    camera.position.z = dist;
}

function initScene() {
    scene = new THREE.Scene();
    var p = getPreview();
    _cachedSkybox = createSkybox(p);
    _skyboxColorKey = (p.skyColorTop || '') + '|' + (p.skyColorBottom || '') + '|' + (p.skyColorSide || '');
    scene.background = (p.showSkybox !== false) ? _cachedSkybox : new THREE.Color('#222222');
    scene._axisHelper = new THREE.AxisHelper(5);
    if (getPreview().showAxis !== false) {
        scene.add(scene._axisHelper);
    }
}

function initLight() {
    var p = getPreview();
    light[0] = new THREE.AmbientLight(p.ambientColor || '#666666');
    light[1] = new THREE.DirectionalLight(p.directionalColor || '#887766');
    light[1].position.set(-1, 1, 1).normalize();
    scene.add(light[0]);
    scene.add(light[1]);
}

function initRenderer() {
    var target = document.getElementById("modelTarget");
    var w = target.clientWidth || 800;
    var h = Math.min(w * 0.75, 600);
    // Guard against zero height when modal is initially hidden
    if (h < 100) h = 450;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    effect = new THREE.OutlineEffect(renderer);
}

function initContainer() {
    container = document.createElement("div");
    container.id = "modelTargetF";
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.appendChild(renderer.domElement);
    document.getElementById("modelTarget").appendChild(container);
}

function initControl() {
    var p = getPreview();
    controls = new THREE.OrbitControls(camera, document.getElementById("modelTarget"));
    controls.autoRotate = p.autoRotate !== false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 100;
    controls.target.set(0, 10, 0);
    controls.update();
}

function initLoader() {
    loader.MMDLoader = new THREE.MMDLoader();
    loader.XLoader = new THREE.XLoader();
}

function initMMDHelper() {
    mmdHelper = new MMDAnimationHelper({
        sync: true,
        afterglow: 2.0,
        resetPhysicsOnLoop: true,
        pmxAnimation: true
    });
}

function initEventListener() {
    window.addEventListener("resize", onWindowResize, false);
    // Bootstrap modal opens with 0×0 then transitions — resize when fully shown
    $('#myModal').on('shown.bs.modal', function () {
        applyPreviewSettings();
        setTimeout(onWindowResize, 150);
    });
}

function onWindowResize() {
    var target = document.getElementById("modelTarget");
    if (!target) return;
    var w = target.clientWidth || 800;
    var h = Math.min(w * 0.75, 600);
    if (h < 100) h = 450;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    effect.setSize(w, h);
}

function onProgress(xhr) {
    if (xhr.lengthComputable) {
        var percentComplete = (xhr.loaded / xhr.total) * 100;
        console.log(Math.round(percentComplete, 2) + "% downloaded");
    }
}

function clearCache(item) {
    if (item instanceof THREE.Mesh) {
        if (mmdHelper && mmdHelper.objects.has(item)) {
            mmdHelper.remove(item);
        }
        if (item.geometry) item.geometry.dispose();
        if (item.material) {
            for (let i = 0; i < item.material.length; i++) {
                item.material[i].dispose();
            }
        }
    }
    if (item === sceneModel) sceneModel = null;
    if (item === model) model = null;
    THREE.Cache.clear();
}

function resetCamera() {
    var dist = getPreview().cameraDistance || 30;
    camera.position.set(0, 10, dist);
    controls.target.set(0, 10, 0);
    controls.update();
}
window.resetCamera = resetCamera;

function setupModel(m, isScene) {
    if (!mmdHelper.objects.get(m)) {
        mmdHelper.add(m, { physics: false });
    }
    if (isScene) {
        sceneModel = m;
    } else {
        model = m;
    }
}

// Load a scene model without replacing the character model
function loadSceneModel(m) {
    if (sceneModel) {
        scene.remove(sceneModel);
        clearCache(sceneModel);
    }
    scene.add(m);
    setupModel(m, true);
    resetCamera();
}

// Load a character model without replacing the scene model
function loadCharacterModel(m) {
    if (model) {
        scene.remove(model);
        clearCache(model);
    }
    scene.add(m);
    setupModel(m, false);
    resetCamera();
}

function playAnimation() {
    // VMD always targets the character model
    var target = model || sceneModel;
    if (target) {
        var objects = mmdHelper.objects.get(target);
        if (objects && !objects.mixer && target.geometry.animations && target.geometry.animations.length > 0) {
            mmdHelper._setupMeshAnimation(target, target.geometry.animations);
        }
    }
    mmdHelper.enable('animation', true);
}

function stopAnimation() {
    mmdHelper.enable('animation', false);
    var target = model || sceneModel;
    if (target) {
        var objects = mmdHelper.objects.get(target);
        if (objects && objects.mixer) {
            for (var i = 0; i < objects.mixer._actions.length; i++) {
                objects.mixer._actions[i].stop();
            }
        }
    }
}

function render() {
    var delta = clock.getDelta();
    if (model || sceneModel) {
        controls.update();
        mmdHelper.update(delta);
        effect.render(scene, camera);
    }
}

// Capture current 3D view as a base64 PNG data URL.
// Temporarily disables auto-rotate to get a clean static shot.
function capturePreview() {
    if (!renderer) return null;
    var prevAutoRotate = controls ? controls.autoRotate : false;
    if (controls) controls.autoRotate = false;
    controls && controls.update();
    // OutlineEffect.render performs the real render (normal pass + outline pass),
    // so a separate renderer.render here would only duplicate the GPU work.
    effect.render(scene, camera);
    var dataUrl = renderer.domElement.toDataURL('image/png');
    if (controls) controls.autoRotate = prevAutoRotate;
    return dataUrl;
}
window.capturePreview = capturePreview;

window.captureCurrentModelPreview = function() {
    if (!window.model) return;
    var modelPath = window.model.userData.modelPath;
    if (!modelPath) return;
    var previewPath = window.path.dirname(modelPath) + '/' + window.path.basename(modelPath).replace(/\.[^.]+$/, '') + '.png';
    var renderSettings = (window.store && window.store.state.settings && window.store.state.settings.render) || { autoRotate: false, showAxis: false };
    if (!renderSettings.autoRotate) renderSettings.autoRotate = false;
    var prevAutoRotate = window.controls ? window.controls.autoRotate : false;
    window.applyPreviewSettings && window.applyPreviewSettings(renderSettings);
    var dataUrl = window.capturePreview();
    if (dataUrl && window.savePreviewImage) {
        window.savePreviewImage(previewPath, dataUrl.replace(/\\/g, '/'));
        window.showNotify && window.showNotify('预览图已保存', 'success');
    }
    window.applyPreviewSettings && window.applyPreviewSettings();
    if (window.controls) window.controls.autoRotate = prevAutoRotate;
};

function animate() {
    requestAnimationFrame(animate);
    render();
}

function init() {
    initCamera();
    initScene();
    initLight();
    initRenderer();
    initContainer();
    initLoader();
    initMMDHelper();
    initControl();
    initEventListener();
}

function getPreview() {
    var s = window.store && window.store.state && window.store.state.settings;
    return (s && s.preview) || {};
}

var _cachedSkybox = null;

var _skyboxColorKey = '';

function applyPreviewSettings(override) {
    var p = override || getPreview();
    if (light[0]) light[0].color.set(p.ambientColor || '#666666');
    if (light[1]) light[1].color.set(p.directionalColor || '#887766');
    if (scene._axisHelper) {
        if (p.showAxis !== false) scene.add(scene._axisHelper);
        else scene.remove(scene._axisHelper);
    }
    if (controls) controls.autoRotate = p.autoRotate !== false;
    if (camera) {
        camera.fov = p.cameraFov || 45;
        camera.position.z = p.cameraDistance || 30;
        camera.updateProjectionMatrix();
    }
    // Skybox toggle
    var colorKey = (p.skyColorTop || '') + '|' + (p.skyColorBottom || '') + '|' + (p.skyColorSide || '') + '|' + (p.skyboxMode || '') + '|' + (p.skyboxImagePath || '');
    if (p.showSkybox !== false) {
        if (!_cachedSkybox || _skyboxColorKey !== colorKey) {
            _cachedSkybox = createSkybox(p);
            _skyboxColorKey = colorKey;
        }
        scene.background = _cachedSkybox;
    } else {
        scene.background = new THREE.Color('#222222');
    }
}
window.applyPreviewSettings = applyPreviewSettings;

function loadImageSkybox(imagePath) {
    try {
        var st = window.fs.statSync(imagePath);
        if (st.isDirectory()) {
            // Load 6-face cubemap from folder
            var faces = [];
            var names = ['right', 'left', 'top', 'bottom', 'front', 'back'];
            var exts = ['.jpg', '.jpeg', '.png', '.bmp'];
            for (var i = 0; i < names.length; i++) {
                var found = null;
                for (var j = 0; j < exts.length; j++) {
                    var fp = imagePath + '/' + names[i] + exts[j];
                    if (window.fs.existsSync(fp)) { found = fp; break; }
                }
                if (!found) {
                    // Try posx/negx naming
                    var altNames = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'];
                    for (var k = 0; k < exts.length; k++) {
                        var ap = imagePath + '/' + altNames[i] + exts[k];
                        if (window.fs.existsSync(ap)) { found = ap; break; }
                    }
                }
                if (found) {
                    var img = new Image();
                    img.src = found;
                    faces.push(img);
                } else {
                    return null;
                }
            }
            var cubeTex = new THREE.CubeTexture(faces);
            cubeTex.needsUpdate = true;
            return cubeTex;
        } else {
            // Single equirectangular image
            var texLoader = new THREE.TextureLoader();
            return texLoader.load(imagePath);
        }
    } catch(e) {
        console.error('Failed to load skybox image:', e);
        return null;
    }
}

function createSkybox(p) {
    var size = 256;
    p = p || {};
    if (p.skyboxMode === 'image' && p.skyboxImagePath) {
        var imgSky = loadImageSkybox(p.skyboxImagePath);
        if (imgSky) return imgSky;
        // Fallback to color on load failure
    }
    // Helper: lighten/darken a color by mixing with white/black
    function lighter(hex) {
        var r = parseInt(hex.slice(1,3), 16);
        var g = parseInt(hex.slice(3,5), 16);
        var b = parseInt(hex.slice(5,7), 16);
        r = Math.min(255, r + Math.round((255 - r) * 0.3));
        g = Math.min(255, g + Math.round((255 - g) * 0.3));
        b = Math.min(255, b + Math.round((255 - b) * 0.3));
        return '#' + [r,g,b].map(function(v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    }
    function darker(hex) {
        var r = parseInt(hex.slice(1,3), 16);
        var g = parseInt(hex.slice(3,5), 16);
        var b = parseInt(hex.slice(5,7), 16);
        r = Math.round(r * 0.8);
        g = Math.round(g * 0.8);
        b = Math.round(b * 0.8);
        return '#' + [r,g,b].map(function(v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    }

    function makeCanvas(topColor, bottomColor) {
        var c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        var ctx = c.getContext('2d', { willReadFrequently: true });
        var grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, topColor);
        grad.addColorStop(0.5, bottomColor);
        grad.addColorStop(1, bottomColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return c;
    }

    var topColor    = p.skyColorTop    || '#87CEEB';
    var bottomColor = p.skyColorBottom || '#E8E8E8';
    var sideColor   = p.skyColorSide   || '#B8D8F0';

    var skyTop    = makeCanvas(topColor, lighter(topColor));
    var skyBottom = makeCanvas(bottomColor, darker(bottomColor));
    var skySide   = makeCanvas(sideColor, lighter(sideColor));

    var cubeMap = new THREE.CubeTexture([
        skySide, skySide, skyTop, skyBottom, skySide, skySide
    ]);
    cubeMap.needsUpdate = true;
    return cubeMap;
}

init();
animate();


