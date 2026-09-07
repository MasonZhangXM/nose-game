import { SPAWN_INTERVAL } from '../core/constants.js';
import { gameState } from '../core/gameState.js';
import { PopBubbleTarget } from '../targets/BubbleTargets.js';

/**
 * 游戏模式基类（就像一个“模板”）。
 * 为什么要用基类：因为不同模式（泡泡、躲避、切水果）有很多共同点，比如都要记分、都要生成目标。
 * 把共同点写在这里，子类（具体的模式）只需要写自己独特的地方。
 * 
 * 核心思想：
 * 1. 子类继承基类，获得基类的能力。
 * 2. 子类重写（覆盖）基类的方法，实现自己的逻辑。
 */
export class BaseGameMode {
    /**
     * 初始化模式。
     * @param {object} deps 依赖项（就像做饭需要的调料，这里需要记分员和连击显示器）
     * @param {ScoreManager} deps.scoreManager 分数管理器，负责加分减分
     * @param {ComboDisplay} deps.comboDisplay 连击显示器，负责显示连击特效
     * @param {Function} deps.onGameOver 游戏结束时的回调函数
     */
    constructor({ scoreManager, comboDisplay, onGameOver }) {
        this.scoreManager = scoreManager;
        this.comboDisplay = comboDisplay;
        this.onGameOver = onGameOver;
    }

    /**
     * 当进入该模式时调用（相当于“游戏开始”）。
     * 子类可以在这里重置分数、生命值等。
     */
    onEnter() {}

    /**
     * 当退出该模式时调用（相当于“游戏结束”）。
     * 子类可以在这里清理资源。
     */
    onExit() {}

    /**
     * 每帧更新逻辑（除了生成目标以外的逻辑）。
     * 比如：检查时间是否到了、更新特殊的动画状态等。
     * @param {number} now 当前时间戳
     */
    update(now) {}

    /**
     * 绘制模式特有的 UI（比如倒计时、生命值）。
     * @param {CanvasRenderingContext2D} ctx 画笔
     * @param {number} now 当前时间戳
     */
    drawHud(ctx, now) {}

    /**
     * 获取生成目标的间隔时间（毫秒）。
     * 为什么这么做：不同模式节奏不同，而且随着时间推移，节奏可能会变快。
     * @param {number} now 当前时间戳
     * @returns {number|null} 返回 null 表示本模式不自动生成目标（比如 Quiz 模式是按轮次生成的）
     */
    getSpawnInterval(now) {
        // 默认实现：根据全局速度倍率调整生成速度
        return SPAWN_INTERVAL / gameState.speedMultiplier;
    }

    /**
     * 创建本模式的一个目标物体（就像工厂生产一个零件）。
     * 子类必须实现这个方法，告诉我们要生成什么样的目标（泡泡？陨石？足球？）。
     * @returns {object} 目标对象（需要有 update() 和 draw(ctx) 方法）
     */
    createTarget() {
        // 默认生成泡泡，子类应该覆盖这个方法
        return new PopBubbleTarget();
    }

    /**
     * 处理“碰到一个目标”时发生什么。
     * 返回值规则保持和旧代码兼容：
     * - true：移除当前目标
     * - false：不移除（比如颠球只是反弹）
     * - 'reset' / 'nuke_clear' / 'keep_bombs'：让主循环做特殊处理
     * @param {object} t 目标对象
     * @param {number} player 玩家 1/2
     * @param {object|null} hitPoint 命中点（颠球会用到）
     * @returns {boolean|string}
     */
    handleCollision(t, player = 1, hitPoint = null) {
        return true;
    }
}
