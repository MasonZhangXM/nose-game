/**
 * 核心游戏状态管理器 (gameState.js)
 * 作用：就像一个记事本，记录游戏当前的所有信息。
 * 为什么这样做：如果把这些信息散落在各个文件里，找起来会很麻烦。
 * 放在一个地方，所有脚本都可以随时查看和修改游戏状态。
 */
export const gameState = {
    // 基础信息
    score: 0,           // 当前得分
    gameActive: false,  // 游戏是否正在进行中
    targets: [],        // 屏幕上所有的目标物体（气泡、水果等）
    particles: [],      // 粒子效果（爆炸时的碎片）
    confettis: [],      // 庆祝时的彩带
    floatingTexts: [],  // 飘起来的文字（如 "+10分"）
    nosePos: { x: 0, y: 0 }, // 鼻子的当前位置
    lastSpawnTime: 0,   // 上一次生成目标的时间
    
    // 游戏设置
    interactionMode: 'nose', // 操控方式：nose(鼻子), single(单手), body(全身)
    speedMultiplier: 1.0,    // 速度倍率：控制游戏快慢
    gameMode: 'pop',         // 当前游戏模式
    playerCount: 1,          // 玩家人数
    currentMode: null,       // 当前模式的实例对象（处理具体逻辑）
    
    // 双人模式专用数据
    player1Score: 0,
    player2Score: 0,
    player1Pos: { x: 0, y: 0 },
    player2Pos: { x: 0, y: 0 },
    player1Lives: 3,
    player2Lives: 3,
    
    // 连击系统 (Combo)
    comboCount: 0,
    comboTimer: null,
    comboCountP2: 0,
    comboTimerP2: null,
    lives: 3, // 生命值（部分模式用到）
    
    // 问答模式状态
    quizState: {
        active: false,
        targetChar: null,
        timer: 0,
        phase: 'waiting',
        nextQuestionTime: 0,
        startTime: 0,
        timeLimit: 300000
    },
    quizCombo: 0,
    
    // 道具状态
    feverMode: false,      // 是否处于狂热模式
    feverTimer: 0,         // 狂热模式剩余时间
    timeScale: 1.0,        // 时间流速 (1.0 = 正常, 0.5 = 慢放)
    isFrozen: false,       // 是否冻结（冰冻道具）
    freezeTimer: 0,        // 冻结剩余时间
    isMagnetActive: false, // 是否开启磁铁
    magnetTimer: 0,        // 磁铁剩余时间
    gameStartTime: 0,      // 游戏开始的时间戳
    
    // 拖尾效果数据（记录手指或鼻子的历史位置，画出线条）
    indexFingerTrails: { left: [], right: [] },
    noseTrail: [],
    noseTrailP2: []
};
