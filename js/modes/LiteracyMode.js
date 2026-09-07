import { BaseGameMode } from './BaseGameMode.js';
import { LiteracyBubbleTarget } from '../targets/BubbleTargets.js';
import { gameState } from '../core/gameState.js';
import { playSound, speakText } from '../utils/audio.js';
import { FloatingText } from '../visuals/FloatingText.js';
import { spawnParticles } from '../visuals/ParticleSystem.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 识字模式 (Literacy Mode)
 * 玩法：戳破带有汉字和拼音的泡泡，学习生字。
 * 特点：戳破泡泡时会朗读，支持连击和 Fever 模式。
 */
export class LiteracyMode extends BaseGameMode {
    constructor(deps) {
        super(deps);
        this.comboCount = 0; // 当前连击数
        this.comboTimerId = null; // 连击计时器
    }

    /**
     * 获取生成目标的间隔时间
     * 覆盖基类方法，用于控制生成频率和最大数量
     */
    getSpawnInterval(now) {
        // 限制屏幕上最大存在的泡泡数量，防止太多太乱
        // 如果当前泡泡数量 >= 4，暂停生成
        if (gameState.targets.length >= 4) {
            return null;
        }
        
        // 降低生成频率：基础间隔 3000ms (原 2500ms)
        // 这样给用户更多时间去读和选
        return 3000 / gameState.speedMultiplier;
    }

    /**
     * 生成带有汉字的泡泡
     */
    createTarget() {
        return new LiteracyBubbleTarget();
    }

    /**
     * 处理戳破泡泡
     */
    handleCollision(t, player = 1) {
        const canvas = getCanvas();
        // 计算视觉坐标（因为目标绘制时被镜像了，但特效绘制没有镜像）
        // t.x 是逻辑坐标（0在左），绘制时翻转到了右边（W-x）。
        // FloatingText 是标准绘制，所以需要手动传 W-x 才能和泡泡视觉位置重合。
        const visualX = canvas.width - t.x;
        
        const isGold = t.subType === 'gold';
        const points = isGold ? 50 : 10;
        // 如果处于 Fever 模式，分数翻倍
        const multiplier = gameState.feverMode ? 2 : 1;
        this.scoreManager.add(player, points * multiplier);

        // 朗读汉字和组词
        // 增加一个微小的延迟，避免与 playSound 的音频上下文抢占资源
        setTimeout(() => {
            speakText(t.char + "，" + t.word);
        }, 100);
        
        // 特效：粒子爆炸、飘字
        spawnParticles(visualX, t.y, t.color);
        // 调整文字位置：居中显示在泡泡原位置，拼音在上，汉字在下
        // 使用不同颜色区分，更清晰
        gameState.floatingTexts.push(new FloatingText(visualX, t.y - 25, t.pinyin, '#00FFFF')); // 青色拼音
        gameState.floatingTexts.push(new FloatingText(visualX, t.y + 15, t.word, '#FFFFFF'));   // 白色词组

        if (isGold) {
            playSound(600, 'sine');
            gameState.floatingTexts.push(new FloatingText(visualX, t.y - 50, "⭐ 很棒！", "#FFD700"));
        } else {
            playSound(400, 'triangle');
        }

        // 处理连击逻辑
        this.comboCount++;
        // 如果连击超过 5 次，进入 Fever 模式
        if (this.comboCount >= 5) {
            if (!gameState.feverMode) {
                gameState.feverMode = true;
                gameState.floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height / 2, "🔥 FEVER! 🔥", "#FFD700"));
                playSound(1000, 'sawtooth');
            }
            gameState.feverTimer = Date.now() + 3000; // 延长 Fever 时间
        }

        // 显示连击数
        if (this.comboCount > 1) {
            this.comboDisplay.show(this.comboCount + (gameState.feverMode ? " 🔥" : ""), gameState.feverMode);
        }

        // 重置连击计时器，如果在 4 秒内没有继续戳破，连击中断
        if (this.comboTimerId) clearTimeout(this.comboTimerId);
        this.comboTimerId = setTimeout(() => {
            this.comboCount = 0;
            gameState.feverMode = false;
            this.comboDisplay.hide();
        }, 4000);

        return true; // 移除泡泡
    }
}
