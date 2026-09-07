# 🎮 鼻尖大消除 (Nose Game)

这是一个基于 MediaPipe 的体感游戏，无需下载安装，打开网页即可游玩！

## 🕹️ 游戏介绍
通过摄像头捕捉你的身体动作，控制游戏中的角色或道具。支持多种模式：
- **👃 鼻尖消除**：用鼻子触碰屏幕上的泡泡。
- **☄️ 陨石躲避**：移动身体躲避从天而降的陨石。
- **🦵 膝盖颠球**：用膝盖顶球，挑战最高分。
- **📚 识字大挑战**：寓教于乐，通过动作学习汉字。

## 🚀 如何运行

### 方法 1：在线游玩 (推荐)
访问 GitHub Pages 地址：[点击这里直接开始游戏](https://你的用户名.github.io/你的仓库名/)
*(注意：首次加载可能需要几秒钟加载 AI 模型)*

### 方法 2：本地运行
如果你想在自己的电脑上运行或修改代码：

1.  确保安装了 Python 3。
2.  打开终端，进入项目目录。
3.  运行服务器脚本：
    ```bash
    python server.py
    ```
4.  在浏览器中访问：`http://localhost:3005`

## 📦 部署到 GitHub Pages

这个游戏完全由前端技术 (HTML, CSS, JavaScript) 构建，非常适合部署到 GitHub Pages。

1.  **创建仓库**：在 GitHub 上创建一个新的仓库（例如 `nose-game`）。
2.  **上传代码**：将所有文件（包括 `js`, `style.css`, `index.html` 等）推送到该仓库。
    *   ⚠️ **注意**：确保 `js/libs` 目录下的所有文件都上传成功，不要漏掉 `.wasm` 或 `.data` 文件。
3.  **开启 Pages**：
    -   进入仓库的 **Settings** (设置)。
    -   在左侧菜单找到 **Pages**。
    -   在 **Build and deployment** 下的 **Source** 选择 `Deploy from a branch`。
    -   在 **Branch** 选择 `main` (或 `master`) 分支，文件夹选择 `/ (root)`。
    -   点击 **Save**。
4.  **等待构建**：等待几分钟，GitHub 会给出一个链接（通常是 `https://用户名.github.io/仓库名/`）。
5.  **开始游戏**：点击链接，允许摄像头权限，即可开始游玩！

## 🛠️ 技术栈
- **核心逻辑**：原生 JavaScript (ES6+)
- **AI 视觉**：Google MediaPipe (Pose, FaceMesh)
- **渲染引擎**：HTML5 Canvas
- **样式布局**：CSS3 (Flexbox, Grid)

## 📄 版权说明
本项目仅供学习和娱乐使用。
