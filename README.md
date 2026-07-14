# 重要！请下载带有 Setup 字样的安装程序！！

# MMDManager


MikuMikuDance（MMD）模型/场景/动作/特效资源管理器。支持拖拽导入、3D 预览、批量截图、一键导出到 MMD。

## 功能

- **拖拽导入**：支持同时拖入多个文件夹，自动分类到模型/场景/VMD/MME
- **3D 预览**：点击"模"加载模型，鼠标旋转/缩放/平移视角
- **自动截图**：导入或加载模型后自动生成预览缩略图
- **预览悬浮**：鼠标悬停"模"按钮显示大图，缩略图模式直接展示
- **VMD 动作**：点击"动"播放动作，未加载模型时自动加载默认模型
- **导出 MMD**：右键"模"或"动"发送到 MMD 软件，贴图正常加载
- **批量导入**：多文件夹拖入时弹出列表对话框，逐个选择模型/场景
- **进度条**：导入时右上角显示实时进度
- **分页**：可配置每页显示数量
- **软件管理**：`software/` 目录放入 `.exe` 自动识别到菜单栏

## 开发

```bash
npm install
npm start        # 启动开发模式
npm run build    # 打包
```

## 目录结构

```
├── main.js          # Electron 主进程
├── preload.js       # 预加载脚本（IPC 桥接）
├── index.html       # 主页面
├── package.json
├── css/             # 样式
├── js/              # 渲染进程脚本
│   ├── main.js      # 入口 / 导入逻辑
│   ├── components.js # Vue 组件
│   ├── show.js      # Three.js 3D 渲染
│   ├── manager.js   # 路径管理
│   └── lib/         # 第三方库
├── data/            # 用户数据（模型/场景/VMD/MME）
├── software/        # 可执行程序（菜单栏自动识别）
└── project/         # 工程文件
```

## 技术栈

- Electron
- Vue 2 + Vue Router + Vuex
- Element UI
- Three.js + MMDLoader
