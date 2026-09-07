/**
 * 主程序入口 (main.js)
 * 作用：这里是游戏的指挥中心。它负责：
 * 1. 启动摄像头
 * 2. 监听玩家的操作（点击按钮、选择模式）
 * 3. 运行游戏主循环（每一帧画什么）
 * 4. 把各个模块（如计分、音乐、游戏模式）组合在一起
 */

// 引入其他模块文件
import { gameState } from './core/gameState.js'; // 游戏状态
import { MAX_TRAIL_LENGTH, SPAWN_INTERVAL, COURSE_STRUCTURE } from './core/constants.js'; // 常量
import { ScoreManager } from './managers/ScoreManager.js'; // 分数管理器
import { ComboDisplay } from './managers/ComboDisplay.js'; // 连击显示
import { LeaderboardManager } from './managers/LeaderboardManager.js'; // 排行榜
import { initTTS, initBGMSelector, toggleBGM, playSound, speakText, testTTS, unlockAudio } from './utils/audio.js'; // 音频工具
import { updateSubCategories } from './utils/gameLogic.js'; // 游戏逻辑辅助

// 引入各种游戏模式
import { PopMode } from './modes/PopMode.js';
import { DodgeMode } from './modes/DodgeMode.js';
import { JuggleMode } from './modes/JuggleMode.js';
import { SliceMode } from './modes/SliceMode.js';
import { LiteracyMode } from './modes/LiteracyMode.js';
import { QuizMode } from './modes/QuizMode.js';

// 获取 HTML 页面上的元素（就像给 HTML 元素起个名字，方便 JS 控制）
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d'); // 画笔，用于在 Canvas 上绘图
const scoreElement = document.getElementById('score');
const loadingElement = document.getElementById('loading');
const gameOverElement = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');

// 初始化管理器
const scoreManager = new ScoreManager({
    scoreEl: scoreElement,
    scoreP2El: document.getElementById('score-p2')
});
const comboDisplay = new ComboDisplay();
const leaderboardManager = new LeaderboardManager();

// 存储 AI 识别对象
let pose = null;   // 姿势识别模型
let faceMesh = null; // 人脸网格模型 (双人模式用)
let camera = null; // 摄像头控制对象

window.__mpStatus = { libs: false, poseReady: false, faceMeshReady: false, cameraStartCalled: false, cameraStarted: false };

// 简单的玩家位置追踪器 (避免玩家 ID 跳变)
const playerTracker = {
    p1: null, // {x, y, lastSeen}
    p2: null,
    // 判断两个点的距离
    dist: (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)),
    reset: () => {
        playerTracker.p1 = null;
        playerTracker.p2 = null;
    }
};

/**
 * 动态加载 FaceMesh 库
 */
function loadFaceMesh() {
    return new Promise((resolve, reject) => {
        if (typeof FaceMesh !== 'undefined') {
            resolve();
            return;
        }
        console.log("正在加载 FaceMesh...");
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
        script.onload = () => {
            console.log("FaceMesh 加载完成");
            resolve();
        };
        script.onerror = (e) => {
            console.error("FaceMesh 加载失败", e);
            reject(e);
        };
        document.head.appendChild(script);
    });
}

/**
 * 工厂函数：创建游戏模式
 * 作用：根据传入的名字（如 'dodge'），生产出对应的游戏模式对象
 */
function createMode(modeName) {
    // 准备好模式需要的依赖工具
    const deps = { 
        scoreManager, 
        comboDisplay,
        onGameOver: endGame // 把“结束游戏”这个功能传给模式，让它能在需要时结束游戏
    };

    if (modeName === 'dodge') return new DodgeMode(deps);
    if (modeName === 'juggle') return new JuggleMode(deps);
    if (modeName === 'slice') return new SliceMode(deps);
    if (modeName === 'literacy') return new LiteracyMode(deps);
    if (modeName === 'quiz') return new QuizMode(deps);
    return new PopMode(deps); // 默认模式
}

// 定义一个本地的 updateSubCategoriesUI 函数，用来作为 HTML 事件处理
function updateSubCategoriesUI() {
    const category = document.getElementById('course-category').value;
    updateSubCategories(category);
}

function closeLeaderboard() {
    leaderboardManager.close(() => startGame(true));
}

// 把一些函数挂载到 window 对象上
// 为什么这么做：因为 HTML 中的 onclick="startGame()" 需要访问这些函数，
// 而模块化(Module)脚本中的函数默认是私有的，外部看不见。
window.startGame = startGame;
window.returnToMenu = returnToMenu;
window.restartGame = restartGame;
window.toggleBGM = toggleBGM; 
window.updateSubCategories = updateSubCategoriesUI; 
window.closeLeaderboard = closeLeaderboard; // 确保 closeLeaderboard 也能被访问
window.submitHighScore = submitHighScore;
window.testTTS = testTTS;

// 当页面加载完成后执行初始化
window.addEventListener('DOMContentLoaded', () => {
    initTTS();           // 初始化语音合成
    initBGMSelector();   // 初始化音乐选择器
    initSubCategories(); // 初始化课程下拉菜单
    
    // 绑定 BGM 开关（复选框）
    const bgmToggle = document.getElementById('bgm-toggle');
    if (bgmToggle) {
        bgmToggle.addEventListener('change', (e) => {
            // 首次用户交互时解锁音频
            unlockAudio();
            toggleBGM(e.target.checked);
        });
    }
    // 任意一次用户点击，尝试解锁音频策略（只执行一次）
    document.body.addEventListener('pointerdown', () => unlockAudio(), { once: true });
    document.body.addEventListener('keydown', () => unlockAudio(), { once: true });
    
    const modeRadios = document.getElementsByName('gamemode');
    
    // 统一处理模式切换逻辑
    const handleModeChange = (val) => {
        const literacySettings = document.getElementById('literacy-settings');
        const ttsSettings = document.getElementById('tts-settings');
        
        // 获取双人模式相关元素
        const players2Radio = document.getElementById('players-2');
        const players2Label = document.querySelector('label[for="players-2"]');
        const players1Radio = document.getElementById('players-1');

        // 获取操控方式相关元素
        const optNose = document.getElementById('opt-nose');
        const optSingle = document.getElementById('opt-single');
        const optBody = document.getElementById('opt-body');
        const modeBody = document.getElementById('mode-body');
        const modeNose = document.getElementById('mode-nose');

        // 识字模式强制单人并隐藏双人选项
        if (val === 'literacy') {
            if (players1Radio) players1Radio.checked = true;
            if (players2Radio) {
                    players2Radio.disabled = true;
                    players2Radio.style.display = 'none';
            }
            if (players2Label) players2Label.style.display = 'none';
        } else {
            // 其他模式恢复双人选项
            if (players2Radio) {
                    players2Radio.disabled = false;
                    players2Radio.style.display = '';
            }
            if (players2Label) players2Label.style.display = '';
        }

        // 膝盖颠球模式：隐藏鼻子和双手，强制躯干/膝盖
        if (val === 'juggle') {
            if (optNose) optNose.style.display = 'none';
            if (optSingle) optSingle.style.display = 'none';
            if (optBody) optBody.classList.remove('hidden'); // 确保躯干选项显示
            if (modeBody) modeBody.checked = true; // 自动选中躯干
        } else if (val === 'literacy' || val === 'quiz') {
            // 识字和问答恢复默认
             if (optNose) optNose.style.display = '';
             if (optSingle) optSingle.style.display = '';
             // 注意：这里我们可能想保持原本的 hidden 状态，或者全部显示
             // 简单起见，恢复显示鼻子和双手，躯干默认可能是隐藏的
        } else {
             if (optNose) optNose.style.display = '';
             if (optSingle) optSingle.style.display = '';
        }

        // 陨石模式也是隐藏鼻子和双手（之前逻辑）
        if (val === 'dodge') {
             if (optNose) optNose.style.display = 'none';
             if (optSingle) optSingle.style.display = 'none';
             if (optBody) optBody.classList.remove('hidden');
             if (modeBody) modeBody.checked = true;
        }

        // 根据模式显示/隐藏特定设置
        if (val === 'literacy') {
            literacySettings.classList.remove('hidden');
            ttsSettings.classList.add('hidden');
        } else if (val === 'quiz') {
            literacySettings.classList.remove('hidden');
            ttsSettings.classList.remove('hidden');
        } else {
            literacySettings.classList.add('hidden');
            ttsSettings.classList.add('hidden');
        }
    };

    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            handleModeChange(e.target.value);
        });
    });

    // 初始化状态 (确保页面刷新后 UI 正确)
    let currentMode = 'pop';
    modeRadios.forEach(r => { if(r.checked) currentMode = r.value; });
    handleModeChange(currentMode);

    // 初始化摄像头
    initCamera();

    // 移除显式的 gameLoop 调用，完全依赖 MediaPipe 的 onResults 回调来驱动游戏循环
    // 这样可以避免画面闪烁和逻辑冲突
});

// 初始化课程子分类下拉菜单
function initSubCategories() {
    const catSelect = document.getElementById('course-category');
    if (!catSelect) return;
    
    // 确保绑定 change 事件
    catSelect.removeEventListener('change', updateSubCategoriesUI); // 防止重复绑定
    catSelect.addEventListener('change', updateSubCategoriesUI);
    
    // 首次加载时更新一次
    updateSubCategoriesUI();
}


// --- 游戏控制流程 ---

/**
 * 开始游戏
 * @param {boolean} skipLeaderboard - 是否跳过排行榜显示（默认不跳过）
 */
function startGame(skipLeaderboard = false) {
    console.log("正在启动游戏...");

    // 检查是否是问答模式（如果是，先显示排行榜）
    let tempGameMode = 'pop';
    document.getElementsByName('gamemode').forEach(r => { if(r.checked) tempGameMode = r.value; });

    if (tempGameMode === 'quiz' && !skipLeaderboard) {
        leaderboardManager.show(() => {
            startGame(true); // 看完排行榜后，真正开始游戏
        });
        return;
    }

    loadingElement.style.display = '';

    // 如果摄像头还没准备好
    if (!pose || !camera) {
        loadingElement.innerHTML = "⏳ AI模型正在热身中...<br>请稍等片刻";
        loadingElement.classList.remove('hidden');
        return;
    }

    // 隐藏菜单，显示游戏界面
    document.getElementById('start-screen').classList.add('hidden');
    loadingElement.classList.add('hidden');
    document.getElementById('back-btn').classList.remove('hidden');
    gameOverElement.classList.add('hidden');
    scoreElement.innerText = '0';

    // 读取并保存设置到 gameState
    document.getElementsByName('mode').forEach(r => { if(r.checked) gameState.interactionMode = r.value; });
    document.getElementsByName('gamemode').forEach(r => { if(r.checked) gameState.gameMode = r.value; });
    document.getElementsByName('playercount').forEach(r => { if(r.checked) gameState.playerCount = parseInt(r.value); });
    
    // 双人模式：确保 FaceMesh 已加载
    if (gameState.playerCount === 2) {
        if (!faceMesh) {
            loadingElement.innerHTML = "⏳ 正在加载双人模式引擎 (FaceMesh)...<br>这可能需要一点时间";
            loadingElement.classList.remove('hidden');
            
            loadFaceMesh().then(() => {
                console.log("初始化 FaceMesh...");
                faceMesh = new FaceMesh({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                    }
                });
                faceMesh.setOptions({
                    maxNumFaces: 2,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                faceMesh.onResults(onResultsFace);
                window.__mpStatus.faceMeshReady = true;
                console.log("FaceMesh 准备就绪");
                
                loadingElement.classList.add('hidden');
                startGame(true); // 重新调用开始游戏
            }).catch(err => {
                console.error(err);
                loadingElement.innerHTML = "❌ 加载失败，请检查网络";
                setTimeout(() => returnToMenu(), 3000);
            });
            return; // 暂停启动，等待加载
        }
    }

    const speedSlider = document.getElementById('speed-slider');
    gameState.speedMultiplier = parseInt(speedSlider.value) * 0.5;

    // 特殊规则修正
    if (gameState.gameMode === 'quiz' && gameState.interactionMode === 'body') {
        gameState.interactionMode = 'single';
    }

    // 双人模式 UI 调整
    if (gameState.playerCount === 2) {
        document.getElementById('score-board-p2').classList.remove('hidden');
        document.getElementById('score-p2').innerText = '0';
        document.getElementById('center-line').classList.remove('hidden');
    } else {
        document.getElementById('score-board-p2').classList.add('hidden');
        document.getElementById('center-line').classList.add('hidden');
    }

    // 重置游戏状态
    gameState.gameActive = true;
    gameState.score = 0;
    gameState.player1Score = 0;
    gameState.player2Score = 0;
    gameState.targets = [];
    gameState.particles = [];
    gameState.confettis = [];
    gameState.floatingTexts = [];
    gameState.gameStartTime = Date.now();
    gameState.lastSpawnTime = 0;
    playerTracker.reset(); // 重置玩家追踪器

    // 创建并激活当前游戏模式
    gameState.currentMode = createMode(gameState.gameMode);
    if (gameState.currentMode) {
        gameState.currentMode.onEnter();
    }
    
    // 根据设置启动背景音乐（保证先解锁音频）
    unlockAudio();
    const bgmToggle = document.getElementById('bgm-toggle');
    if (bgmToggle && bgmToggle.checked) {
        toggleBGM(true);
    }
}

// 结束游戏
function endGame() {
    gameState.gameActive = false;

    // 显示最终分数
    if (gameState.playerCount === 2) {
        let winner = "";
        const p1Dead = gameState.player1Lives <= 0;
        const p2Dead = gameState.player2Lives <= 0;
        
        if (p1Dead && !p2Dead) winner = "<span style='color:#FFD700'>P2 获胜!</span><br><span style='font-size:20px'>(P1 耗尽生命)</span>";
        else if (p2Dead && !p1Dead) winner = "<span style='color:#FF00FF'>P1 获胜!</span><br><span style='font-size:20px'>(P2 耗尽生命)</span>";
        else if (gameState.player1Score > gameState.player2Score) winner = "<span style='color:#FF00FF'>P1 获胜!</span>";
        else if (gameState.player2Score > gameState.player1Score) winner = "<span style='color:#FFD700'>P2 获胜!</span>";
        else winner = "平局!";
        
        finalScoreElement.innerHTML = `${winner}<br><div style="font-size:24px; margin-top:10px;">P1: ${gameState.player1Score} | P2: ${gameState.player2Score}</div>`;
    } else {
        finalScoreElement.innerText = gameState.score;
    }

    gameOverElement.classList.remove('hidden');
    document.getElementById('back-btn').classList.add('hidden');

    // 如果破纪录了，显示输入名字弹窗
    if (gameState.playerCount === 1 && (gameState.gameMode === 'quiz' || gameState.gameMode === 'literacy')) {
        if (leaderboardManager.checkHighScore(gameState.score)) {
            setTimeout(() => {
                showNameInput();
            }, 1000);
        }
    }
}

// 返回菜单
function returnToMenu() {
    gameState.gameActive = false;
    gameOverElement.classList.add('hidden');
    document.getElementById('back-btn').classList.add('hidden');
    document.getElementById('score-board-p2').classList.add('hidden');
    document.getElementById('center-line').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

// 重新开始
function restartGame() {
    startGame();
}

// --- 名字输入 UI (用于排行榜) ---

function showNameInput() {
    document.getElementById('name-input-modal').classList.remove('hidden');
    renderVirtualKeyboard();
}

function renderVirtualKeyboard() {
    const kb = document.getElementById('virtual-keyboard');
    kb.innerHTML = '';
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789←OK";
    chars.split('').forEach(char => {
        const key = document.createElement('button');
        key.innerText = char;
        key.style.cssText = "padding: 10px; font-size: 18px; min-width: 40px;";
        key.onclick = () => {
            const input = document.getElementById('player-name-input');
            if (char === '←') {
                input.value = input.value.slice(0, -1); // 删除最后一个字符
            } else if (char === 'OK') {
                submitHighScore();
            } else {
                if (input.value.length < 8) input.value += char;
            }
        };
        kb.appendChild(key);
    });
}

function submitHighScore() {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput.value.trim() || "Player";
    leaderboardManager.submitHighScore(name, gameState.score);
    document.getElementById('name-input-modal').classList.add('hidden');
    returnToMenu();
}

// --- 摄像头与 AI 初始化 ---

function initCamera() {
    // 检查 MediaPipe 库是否加载成功
    // 增加 window.isLocalLibsLoaded 检查
    if (typeof Pose === 'undefined' || typeof Camera === 'undefined') {
        console.warn("MediaPipe 尚未加载完成");
        // 既然已经本地化了，如果还 undefined，说明本地文件没加载上（路径错或文件坏）
        loadingElement.innerHTML = '❌ 核心组件加载失败<br>无法读取本地 `js/libs/mediapipe` 文件<br>请检查文件是否完整。<br><button onclick="location.reload()" style="margin-top:10px; padding: 5px 10px;">点击刷新</button>';
        return;
    }
    window.__mpStatus.libs = true;

    // 初始化 Pose 模型
    pose = new Pose({
        locateFile: (file) => {
            const path = `js/libs/mediapipe/pose/${file}`;
            return path;
        }
    });
    window.__mpStatus.poseReady = true;

    pose.setOptions({
        modelComplexity: 1, // 模型复杂度：1是平衡，0是快但准度低，2是慢但准度高
        smoothLandmarks: true, // 平滑处理，防止抖动
        enableSegmentation: false, // 不需要背景分割
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    // 当 AI 识别出结果时，调用 onResults 函数
    pose.onResults(onResults);

    // --- UI Event Listeners for Game Mode ---
    document.querySelectorAll('input[name="gamemode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const p2Radio = document.getElementById('players-2');
            const p1Radio = document.getElementById('players-1');
            const dualHint = document.getElementById('dual-hint');
            
            // 操控方式选项
            const optNose = document.getElementById('opt-nose');
            const optSingle = document.getElementById('opt-single');
            const optBody = document.getElementById('opt-body');
            const modeBody = document.getElementById('mode-body');
            const modeNose = document.getElementById('mode-nose');

            if (e.target.value === 'dodge') {
                // 陨石躲避模式强制单人
                p1Radio.checked = true;
                p2Radio.disabled = true;
                p2Radio.parentElement.classList.add('disabled'); // Optional styling
                if (dualHint) dualHint.style.display = 'none';
                
                // 操控方式限制：隐藏其他，只显示躯干
                if(optNose) optNose.classList.add('hidden');
                if(optSingle) optSingle.classList.add('hidden');
                if(optBody) optBody.classList.remove('hidden');
                if(modeBody) modeBody.checked = true;

                // 提示用户
                const hint = document.createElement('div');
                hint.id = 'dodge-hint';
                hint.style.color = '#FFD700';
                hint.style.fontSize = '14px';
                hint.style.marginTop = '5px';
                hint.innerText = '⚠️ 陨石躲避仅限单人游玩，请移动身体躲避！';
                e.target.parentElement.parentElement.appendChild(hint);
            } else {
                // 其他模式恢复
                p2Radio.disabled = false;
                p2Radio.parentElement.classList.remove('disabled');
                const hint = document.getElementById('dodge-hint');
                if (hint) hint.remove();

                // 恢复操控方式
                if(optNose) optNose.classList.remove('hidden');
                if(optSingle) optSingle.classList.remove('hidden');
                if(optBody) optBody.classList.add('hidden');
                // 恢复默认选中鼻子 (如果当前选中的是 body，则切回 nose)
                if(modeBody && modeBody.checked && modeNose) modeNose.checked = true;
            }
        });
    });

    // 初始化摄像头
    camera = new Camera(videoElement, {
        onFrame: async () => {
            if (gameState.playerCount === 2 && faceMesh) {
                await faceMesh.send({ image: videoElement });
            } else if (pose) {
                await pose.send({ image: videoElement }); // 把视频帧发给 AI 处理
            }
        },
        width: 1280,
        height: 720
    });
    window.__mpStatus.cameraStartCalled = true;

    // 增加超时检测：如果 10秒 还没启动成功，提示用户
    const cameraTimeout = setTimeout(() => {
        if (!document.getElementById('start-screen') || document.getElementById('start-screen').classList.contains('hidden') === false) {
             // 如果 start-screen 还没显示（说明还在 loading）
             loadingElement.innerHTML = '⚠️ 摄像头启动过慢<br>1. 请确保已允许摄像头权限<br>2. 尝试切换浏览器或刷新<br><button onclick="reloadPage()" style="margin-top:10px;">刷新页面</button>';
        }
    }, 10000);

    camera.start()
        .then(() => {
            clearTimeout(cameraTimeout); // 成功启动，取消超时警告
            console.log("摄像头启动成功");
            window.__mpStatus.cameraStarted = true;
            loadingElement.classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
        })
        .catch(err => {
            clearTimeout(cameraTimeout);
            console.error("摄像头错误", err);
            loadingElement.innerHTML = `❌ 摄像头启动失败: ${err.message}<br>请确保允许摄像头权限<br><button onclick="reloadPage()">刷新</button>`;
        });
}

// --- 每一帧的处理逻辑 (Core Loop) ---

/**
 * AI 结果回调函数
 * @param {object} results - MediaPipe 返回的识别结果
 */
function onResults(results) {
    // 隐藏加载提示
    if (loadingElement.style.display !== 'none') {
        loadingElement.style.display = 'none';
    }

    // 优化：仅在尺寸改变且有效时调整 Canvas 大小，避免每帧重置导致闪烁
    // 增加检查：确保 videoWidth/videoHeight 大于 0，防止初始化时或流不稳定时闪烁
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0 && 
        (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight)) {
        console.log(`Canvas resized: ${canvasElement.width}x${canvasElement.height} -> ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 镜像翻转画面（让用户照镜子一样）
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    
    // 1. 绘制视频背景
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // 2. 绘制骨架（除了某些模式外）
    // 用户反馈：选择追踪鼻子时，不要显示其他部分UI (指骨架)
    if (results.poseLandmarks && gameState.gameMode !== 'slice' && gameState.gameMode !== 'pop') {
        // 只有当交互模式不是纯鼻子时，或者调试模式下才显示骨架
        if (gameState.interactionMode !== 'nose') {
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                { color: 'rgba(0, 255, 255, 0.3)', lineWidth: 2 });
            drawLandmarks(canvasCtx, results.poseLandmarks,
                { color: 'rgba(255, 255, 255, 0.5)', lineWidth: 1, radius: 2 });
        }
    }

    // 3. 计算并绘制交互点（鼻子、手）
    let activePoints = []; // 存储所有可以触发碰撞的点
    
    if (results.poseLandmarks) {
        let cursorColor = '#00FFFF'; // 默认青色
        let cursorColorAlt = '#FF00FF'; // 默认洋红色

        // 双人模式下根据位置分配颜色
        if (gameState.playerCount === 2) {
            const noseX = results.poseLandmarks[0].x;
            if (noseX < 0.5) { // 左边玩家
                cursorColor = '#FFD700'; // 金色
                cursorColorAlt = '#FFA500';
            }
        }

        if (gameState.gameMode === 'dodge') {
            // 陨石躲避模式：只追踪躯干中心 (肩膀中点)
            // 强制单人，强制追踪核心，忽略手部和鼻子设置
            if (results.poseLandmarks[11] && results.poseLandmarks[12]) {
                const s1 = results.poseLandmarks[11]; // 左肩
                const s2 = results.poseLandmarks[12]; // 右肩
                const cx = (s1.x + s2.x) / 2 * canvasElement.width;
                const cy = (s1.y + s2.y) / 2 * canvasElement.height;
                
                // 绘制核心光标 (反应堆风格 - 升级版)
                const time = Date.now() / 200;
                
                // 1. 能量光环 (加大)
                const radius = 60 + Math.sin(time) * 10; // 40 -> 60
                const gradient = canvasCtx.createRadialGradient(cx, cy, 20, cx, cy, radius);
                gradient.addColorStop(0, 'rgba(0, 255, 255, 0.4)'); // 0.2 -> 0.4
                gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
                canvasCtx.fillStyle = gradient;
                canvasCtx.beginPath();
                canvasCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
                canvasCtx.fill();

                // 2. 核心实体 (加大 & 发光)
                canvasCtx.save();
                canvasCtx.shadowBlur = 20;
                canvasCtx.shadowColor = '#00FFFF';
                canvasCtx.beginPath();
                canvasCtx.arc(cx, cy, 25, 0, 2 * Math.PI); // 15 -> 25
                canvasCtx.fillStyle = '#00FFFF';
                canvasCtx.fill();
                canvasCtx.restore();
                
                // 3. 旋转外圈 (多层)
                // 内层旋转
                canvasCtx.save();
                canvasCtx.translate(cx, cy);
                canvasCtx.rotate(time);
                canvasCtx.beginPath();
                canvasCtx.arc(0, 0, 35, 0, Math.PI * 1.5); // 22 -> 35
                canvasCtx.strokeStyle = '#FFFFFF';
                canvasCtx.lineWidth = 4;
                canvasCtx.stroke();
                canvasCtx.restore();

                // 外层反向旋转
                canvasCtx.save();
                canvasCtx.translate(cx, cy);
                canvasCtx.rotate(-time * 0.5);
                canvasCtx.beginPath();
                canvasCtx.arc(0, 0, 45, 0, Math.PI * 1.2);
                canvasCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
                canvasCtx.restore();

                activePoints.push({ x: cx, y: cy, player: 1 });
                // 更新 gameState.player1Pos 供 DodgeMode 使用
                gameState.player1Pos = { x: cx, y: cy }; 
            }
        } else if (gameState.gameMode === 'juggle') {
            // 膝盖颠球模式：只追踪膝盖 (25: 左膝, 26: 右膝)
            const knees = [25, 26];
            knees.forEach(idx => {
                if (results.poseLandmarks[idx]) {
                    const k = results.poseLandmarks[idx];
                    const kx = k.x * canvasElement.width;
                    const ky = k.y * canvasElement.height;
                    
                    // 绘制膝盖光标
                    const time = Date.now() / 200;
                    
                    // 1. 光环
                    canvasCtx.beginPath();
                    canvasCtx.arc(kx, ky, 30 + Math.sin(time)*5, 0, 2 * Math.PI);
                    canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.4)'; // 绿色光环
                    canvasCtx.fill();

                    // 2. 核心
                    canvasCtx.beginPath();
                    canvasCtx.arc(kx, ky, 15, 0, 2 * Math.PI);
                    canvasCtx.fillStyle = '#00FF00'; // 亮绿色
                    canvasCtx.fill();
                    
                    // 3. 描边
                    canvasCtx.beginPath();
                    canvasCtx.arc(kx, ky, 15, 0, 2 * Math.PI);
                    canvasCtx.strokeStyle = '#FFF';
                    canvasCtx.lineWidth = 2;
                    canvasCtx.stroke();

                    // 收集交互点
                    if (gameState.playerCount === 2) {
                        const player = k.x < 0.5 ? 2 : 1; 
                        activePoints.push({ x: kx, y: ky, player: player, part: idx === 25 ? 'left' : 'right' });
                    } else {
                        activePoints.push({ x: kx, y: ky, player: 1, part: idx === 25 ? 'left' : 'right' });
                    }
                }
            });
        } else {
        // 处理鼻子交互
        if (gameState.interactionMode === 'nose' || gameState.interactionMode === 'body') {
            const nx = results.poseLandmarks[0].x * canvasElement.width;
            const ny = results.poseLandmarks[0].y * canvasElement.height;
            gameState.nosePos.x = nx; gameState.nosePos.y = ny;
            // 记录鼻子拖尾
            gameState.noseTrail.push({ x: nx, y: ny });
            if (gameState.noseTrail.length > MAX_TRAIL_LENGTH) {
                gameState.noseTrail.shift();
            }
            
            // 绘制鼻子拖尾（酷炫彩虹效果）
            for (let i = 1; i < gameState.noseTrail.length; i++) {
                const p0 = gameState.noseTrail[i - 1];
                const p1 = gameState.noseTrail[i];
                const alpha = i / gameState.noseTrail.length;
                const hue = (Date.now() / 5 + i * 10) % 360; // 动态彩虹色
                
                canvasCtx.beginPath();
                canvasCtx.moveTo(p0.x, p0.y);
                canvasCtx.lineTo(p1.x, p1.y);
                canvasCtx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha * 0.8})`;
                canvasCtx.lineWidth = 20 * alpha; // 加粗：原 12 -> 20
                canvasCtx.lineCap = 'round';
                canvasCtx.stroke();
            }

            // 画鼻子光标（光晕效果）
            const time = Date.now() / 200;
            const radius = 50 + Math.sin(time) * 10; // 呼吸效果加大 (原 35 -> 50)
            
            // 外圈光晕 (范围加大)
            const gradient = canvasCtx.createRadialGradient(nx, ny, 0, nx, ny, radius + 50); // 原 +40 -> +50
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); // 更亮
            gradient.addColorStop(0.4, `hsla(${(time * 100) % 360}, 100%, 50%, 0.7)`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            canvasCtx.fillStyle = gradient;
            canvasCtx.beginPath();
            canvasCtx.arc(nx, ny, radius + 50, 0, 2 * Math.PI); 
            canvasCtx.fill();

            // 核心光标
            canvasCtx.beginPath();
            canvasCtx.arc(nx, ny, 15, 0, 2 * Math.PI); // 核心加大 10 -> 15
            canvasCtx.fillStyle = '#FFF';
            canvasCtx.fill();
            
            // 收集交互点
            if (gameState.playerCount === 2) {
                 const player = results.poseLandmarks[0].x < 0.5 ? 2 : 1; // 镜像后，x<0.5 是右边（P1），但这里可能需要根据实际调整
                 // 修正：镜像前 x<0.5 是画面左侧。镜像后，画面左侧对应画布右侧坐标。
                 // 简单起见，我们用原始 x 判断属于哪个玩家区域
                 activePoints.push({ x: nx, y: ny, player: player });
            } else {
                 activePoints.push({ x: nx, y: ny, player: 1 });
            }
        }
        
        // 处理手部交互
        if (gameState.interactionMode === 'single') {
             // 19: 左食指, 20: 右食指
             const hands = [19, 20];
             let targetHands = [];

             if (gameState.interactionMode === 'single') {
                 // 单手模式：只选择位置较高（y值较小）的那只手
                 let bestHand = null;
                 let minY = Infinity;

                 hands.forEach(idx => {
                     if (results.poseLandmarks[idx]) {
                         const y = results.poseLandmarks[idx].y;
                         if (y < minY) {
                             minY = y;
                             bestHand = idx;
                         }
                     }
                 });
                 if (bestHand) targetHands.push(bestHand);
             } else {
                 // 全身模式（如果还存在）：两只手都追踪
                 targetHands = hands;
             }

             targetHands.forEach(idx => {
                if (results.poseLandmarks[idx]) {
                    const hx = results.poseLandmarks[idx].x * canvasElement.width;
                    const hy = results.poseLandmarks[idx].y * canvasElement.height;
                    
                    // --- 增加手部酷炫拖尾特效 ---
                    const handSide = idx === 19 ? 'left' : 'right';
                    const trail = gameState.indexFingerTrails[handSide];
                    
                    // 更新拖尾数据
                    trail.push({ x: hx, y: hy });
                    if (trail.length > MAX_TRAIL_LENGTH) {
                        trail.shift();
                    }

                    // 绘制拖尾
                    if (trail.length > 1) {
                        canvasCtx.beginPath();
                        // 颜色区分：左手青色，右手洋红色 (对应左右脑/红蓝CP感)
                        const baseColor = idx === 19 ? [0, 255, 255] : [255, 0, 255]; 
                        
                        for (let i = 1; i < trail.length; i++) {
                            const p0 = trail[i - 1];
                            const p1 = trail[i];
                            const alpha = i / trail.length;
                            
                            canvasCtx.moveTo(p0.x, p0.y);
                            canvasCtx.lineTo(p1.x, p1.y);
                        }
                        
                        // 使用光晕风格的描边
                        canvasCtx.lineCap = 'round';
                        canvasCtx.lineJoin = 'round';
                        
                        // 外层发光
                        canvasCtx.shadowBlur = 15;
                        canvasCtx.shadowColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.8)`;
                        canvasCtx.strokeStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.6)`;
                        canvasCtx.lineWidth = 15;
                        canvasCtx.stroke();
                        
                        // 内芯高亮
                        canvasCtx.shadowBlur = 0;
                        canvasCtx.strokeStyle = '#FFFFFF';
                        canvasCtx.lineWidth = 4;
                        canvasCtx.stroke();
                        
                        canvasCtx.beginPath(); // 重置路径以免影响后续绘制
                    }
                    // --- 特效结束 ---

                    // 画手部光标 (原有逻辑保留，但增强一点视觉)
                    canvasCtx.beginPath();
                    canvasCtx.arc(hx, hy, 20, 0, 2 * Math.PI);
                    canvasCtx.fillStyle = idx === 19 ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 0, 255, 0.5)';
                    canvasCtx.fill();
                    canvasCtx.strokeStyle = '#FFF';
                    canvasCtx.lineWidth = 2;
                    canvasCtx.stroke();
                    
                    if (gameState.playerCount === 2) {
                        const player = results.poseLandmarks[0].x < 0.5 ? 2 : 1;
                        activePoints.push({ x: hx, y: hy, player: player });
                    } else {
                        activePoints.push({ x: hx, y: hy, player: 1 });
                    }
                }
             });
        }
        }
    }

    canvasCtx.restore(); // 恢复坐标系（后续绘制不再镜像）

    // 4. 游戏逻辑更新
    runGameLoop(activePoints);

    // 绘制 UI (HUD)
    if (gameState.gameActive && gameState.currentMode) {
        gameState.currentMode.drawHud(canvasCtx, Date.now());
    }

    // 5. 绘制特效
    updateAndDrawEffects();
}

function updateAndDrawEffects() {
    // 粒子效果
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        let p = gameState.particles[i];
        p.update();
        p.draw(canvasCtx);
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }
    
    // 飘字效果
    for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
        let ft = gameState.floatingTexts[i];
        ft.update();
        ft.draw(canvasCtx);
        if (ft.life <= 0) gameState.floatingTexts.splice(i, 1);
    }
}

/**
 * 核心游戏循环 (被 onResults 和 onResultsFace 调用)
 * @param {Array} activePoints - 当前所有的交互点 (鼻子、手等)
 */
function runGameLoop(activePoints) {
    if (gameState.gameActive && gameState.currentMode) {
        const now = Date.now();
        gameState.currentMode.update(now); // 更新模式特定的逻辑
        
        // 生成新目标
        const interval = gameState.currentMode.getSpawnInterval(now);
        if (interval && now - gameState.lastSpawnTime > interval) {
            const target = gameState.currentMode.createTarget();
            if (target) {
                gameState.targets.push(target);
                gameState.lastSpawnTime = now;
            }
        }

        // 绘制和更新目标物体
        for (let i = gameState.targets.length - 1; i >= 0; i--) {
            let t = gameState.targets[i];

            // 绘制目标（注意需要镜像坐标，因为目标是在镜像坐标系下生成的）
            canvasCtx.save();
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
            t.draw(canvasCtx);
            canvasCtx.restore();

            // 更新位置，如果超出屏幕则移除
            if (!t.update()) {
                gameState.targets.splice(i, 1);
                continue;
            }

            // 碰撞检测
            let hit = false;
            let hitPoint = null;
            for (let point of activePoints) {
                const dx = point.x - t.x;
                const dy = point.y - t.y;
                
                // 动态调整碰撞半径：优先使用目标的自定义碰撞半径，否则使用默认半径
                // 增加全局 bonus (例如大脚板道具)
                const collisionRadius = (t.hitRadius || t.radius) + 20 + (gameState.juggleHitRadiusBonus || 0);
                
                if (Math.sqrt(dx*dx + dy*dy) < collisionRadius) { // 简单距离检测
                    hit = true;
                    hitPoint = point;
                    break;
                }
            }

            // 处理碰撞
            if (hit) {
                const hitPlayer = hitPoint.player || 1;
                // 通知当前模式处理碰撞事件
                const result = gameState.currentMode.handleCollision(t, hitPlayer, hitPoint);
                
                // 根据结果处理目标列表
                if (result === 'nuke_clear') {
                    gameState.targets = []; // 清屏炸弹
                    break;
                } else if (result === 'quiz_correct') {
                    gameState.targets = gameState.targets.filter(target => target.type === 'bomb'); // 保留炸弹
                    break;
                } else if (result === 'quiz_wrong' || result === 'reset') {
                    gameState.targets = gameState.targets.filter(target => target.type !== 'bomb');
                    break;
                } else if (result !== false) {
                    gameState.targets.splice(i, 1); // 默认移除被击中的目标
                }
            }
        }
    }
}

/**
 * FaceMesh 结果回调 (双人模式专用)
 */
function onResultsFace(results) {
    // 隐藏加载提示
    if (loadingElement.style.display !== 'none') {
        loadingElement.style.display = 'none';
    }

    // 优化：仅在尺寸改变且有效时调整 Canvas 大小，避免每帧重置导致闪烁
    // 增加检查：确保 videoWidth/videoHeight 大于 0，防止初始化时或流不稳定时闪烁
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0 && 
        (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight)) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 镜像翻转
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    
    // 1. 绘制视频背景
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let activePoints = [];
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        // 1. 提取所有人脸的鼻尖坐标
        const currentFaces = results.multiFaceLandmarks.map(landmarks => {
            return {
                x: landmarks[4].x, 
                y: landmarks[4].y,
                raw: landmarks
            };
        });

        let p1Face = null;
        let p2Face = null;
        let remainingFaces = [...currentFaces];

        // 2. 尝试匹配 P1 (左侧玩家)
        if (playerTracker.p1) {
            let closest = null;
            let minDist = 0.2; // 阈值：20% 屏幕宽度
            let closestIdx = -1;

            remainingFaces.forEach((face, idx) => {
                const d = playerTracker.dist(face, playerTracker.p1);
                if (d < minDist) {
                    minDist = d;
                    closest = face;
                    closestIdx = idx;
                }
            });

            if (closest) {
                p1Face = closest;
                remainingFaces.splice(closestIdx, 1);
            } else {
                playerTracker.p1 = null; // 丢失 P1
            }
        }

        // 3. 尝试匹配 P2 (右侧玩家)
        if (playerTracker.p2) {
            let closest = null;
            let minDist = 0.2;
            let closestIdx = -1;

            remainingFaces.forEach((face, idx) => {
                const d = playerTracker.dist(face, playerTracker.p2);
                if (d < minDist) {
                    minDist = d;
                    closest = face;
                    closestIdx = idx;
                }
            });

            if (closest) {
                p2Face = closest;
                remainingFaces.splice(closestIdx, 1);
            } else {
                playerTracker.p2 = null; // 丢失 P2
            }
        }

        // 4. 处理未匹配的脸 (按位置分配)
        if (remainingFaces.length > 0) {
            // 按 x 坐标从大到小排序 (因为镜像，原始 x 大的在屏幕左边)
            remainingFaces.sort((a, b) => b.x - a.x);
            
            for (let face of remainingFaces) {
                if (!p1Face) {
                    p1Face = face; // 优先分配给 P1 (左)
                } else if (!p2Face) {
                    p2Face = face; // 其次分配给 P2 (右)
                }
            }
        }

        // 5. 绘制和记录
        const processFace = (face, player, color) => {
            const nose = face.raw[4];
            const nx = nose.x * canvasElement.width;
            const ny = nose.y * canvasElement.height;
            
            // 更新追踪器
            if (player === 1) playerTracker.p1 = { x: face.x, y: face.y };
            else playerTracker.p2 = { x: face.x, y: face.y };
            
            // 更新游戏状态
            if (player === 1) gameState.player1Pos = { x: nx, y: ny };
            else gameState.player2Pos = { x: nx, y: ny };

            // --- 双人模式酷炫拖尾 ---
            const trail = player === 1 ? gameState.noseTrail : gameState.noseTrailP2;
            trail.push({ x: nx, y: ny });
            if (trail.length > MAX_TRAIL_LENGTH) trail.shift();

            if (trail.length > 1) {
                canvasCtx.beginPath();
                // P1: 洋红, P2: 金色
                const baseColor = player === 1 ? [255, 0, 255] : [255, 215, 0];
                
                for (let i = 1; i < trail.length; i++) {
                    const p0 = trail[i - 1];
                    const p1 = trail[i];
                    canvasCtx.moveTo(p0.x, p0.y);
                    canvasCtx.lineTo(p1.x, p1.y);
                }
                
                canvasCtx.lineCap = 'round';
                canvasCtx.lineJoin = 'round';
                
                // 外层发光
                canvasCtx.shadowBlur = 15;
                canvasCtx.shadowColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.8)`;
                canvasCtx.strokeStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.6)`;
                canvasCtx.lineWidth = 15;
                canvasCtx.stroke();
                
                // 内芯高亮
                canvasCtx.shadowBlur = 0;
                canvasCtx.strokeStyle = '#FFFFFF';
                canvasCtx.lineWidth = 4;
                canvasCtx.stroke();
                
                canvasCtx.shadowBlur = 0; // Reset shadow
            }
            // --- 特效结束 ---

            // 绘制光标
            canvasCtx.beginPath();
            canvasCtx.arc(nx, ny, 15, 0, 2 * Math.PI);
            canvasCtx.fillStyle = color;
            canvasCtx.fill();
            
            // 光晕
            canvasCtx.beginPath();
            canvasCtx.arc(nx, ny, 30, 0, 2 * Math.PI);
            canvasCtx.strokeStyle = color;
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();

            // 绘制 P1/P2 标签
            canvasCtx.save();
            canvasCtx.translate(nx, ny);
            canvasCtx.scale(-1, 1);
            canvasCtx.fillStyle = color;
            canvasCtx.font = "bold 20px Arial";
            canvasCtx.fillText(`P${player}`, 0, -40);
            canvasCtx.restore();

            activePoints.push({ x: nx, y: ny, player: player });
        };

        if (p1Face) processFace(p1Face, 1, '#FF00FF');
        if (p2Face) processFace(p2Face, 2, '#FFD700');
    }

    canvasCtx.restore();

    // 运行游戏循环
    runGameLoop(activePoints);

    // 绘制 HUD
    if (gameState.gameActive && gameState.currentMode) {
        gameState.currentMode.drawHud(canvasCtx, Date.now());
    }

    // 绘制特效
    updateAndDrawEffects();
}
