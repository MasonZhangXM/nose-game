import { BaseGameMode } from './BaseGameMode.js';
import { SliceTarget } from '../targets/SliceTarget.js';
import { gameState } from '../core/gameState.js';
import { playSound } from '../utils/audio.js';
import { FloatingText } from '../visuals/FloatingText.js';
import { spawnParticles } from '../visuals/ParticleSystem.js';

/**
 * 切水果模式 (Slice Mode)
 * 玩法：类似于“水果忍者”，手指（鼻子）划过水果即可切开。
 * 挑战点：连击切开多个水果分数更高，切到炸弹扣分。
 */
export class SliceMode extends BaseGameMode {
    constructor(deps) {
        super(deps);
        this.comboCount = 0;
        this.comboTimerId = null;
    }

    createTarget() {
        return new SliceTarget();
    }

    handleCollision(t, player = 1) {
        // 切到炸弹
        if (t.type === 'bomb') {
            playSound(100);
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 800);

            // 扣 500 分！
            const newScore = Math.max(0, this.scoreManager.get(player) - 500);
            this.scoreManager.set(player, newScore);
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "BOOM! -500", "#FF0000"));

            // 连击清零
            this.comboCount = 0;
            this.comboDisplay.hide();
            return true;
        }

        // 切到水果
        const points = 10;
        this.comboCount++;
        // 连击加成
        const comboMultiplier = 1 + (Math.floor(this.comboCount / 3) * 0.1);
        const finalPoints = Math.floor(points * comboMultiplier);

        // 显示连击
        if (this.comboCount > 1) {
            this.comboDisplay.show(this.comboCount, false);
        }
        
        // 刷新连击计时器
        if (this.comboTimerId) clearTimeout(this.comboTimerId);
        this.comboTimerId = setTimeout(() => {
            this.comboCount = 0;
            this.comboDisplay.hide();
        }, 2000);

        // 播放切开的音效（锯齿波，比较尖锐）
        playSound(400 + (Math.random() * 200), 'sawtooth');
        spawnParticles(t.x, t.y, t.color);
        gameState.floatingTexts.push(new FloatingText(t.x, t.y, `+${finalPoints}`, t.color));
        this.scoreManager.add(player, finalPoints);
        
        return true;
    }
}
