import { gameState } from '../core/gameState.js';

/**
 * 目标物体基类
 * 所有的游戏目标（泡泡、陨石、足球等）都继承自这个类。
 * 它包含了一些最基本的属性，比如位置、半径、摇摆动画的偏移量。
 */
export class BaseTarget {
    /**
     * @param {object} opts 配置项
     * @param {number} opts.radius 半径，决定了物体的大小
     * @param {number} opts.x 初始 x 坐标
     * @param {number} opts.y 初始 y 坐标
     */
    constructor({ radius = 40, x = 0, y = 0 } = {}) {
        this.radius = radius;
        this.x = x;
        this.y = y;
        // 随机一个偏移量，让每个泡泡的摇摆动作看起来不一样
        this.wobbleOffset = Math.random() * 100;
    }

    /**
     * 获取当前的速度倍率
     * Fever 模式下，所有东西都会变快，这里统一获取倍率，避免魔法数字。
     * @returns {number} 速度倍率 (正常是 1.0, Fever 模式是 1.5)
     */
    getSpeedFactor() {
        // 基础速度 * 时间流速 (支持慢动作)
        let factor = gameState.feverMode ? 1.5 : 1.0;
        return factor * gameState.timeScale;
    }

    // update() 和 draw() 方法留给子类实现
    // update() 负责计算位置、物理效果
    // draw() 负责把自己画在屏幕上
}
