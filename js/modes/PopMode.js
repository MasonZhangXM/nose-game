import { BaseGameMode } from './BaseGameMode.js';
import { PopBubbleTarget } from '../targets/BubbleTargets.js';
import { gameState } from '../core/gameState.js';
import { playSound } from '../utils/audio.js';
import { FloatingText } from '../visuals/FloatingText.js';
import { spawnParticles, spawnConfetti } from '../visuals/ParticleSystem.js';
import { SPAWN_INTERVAL } from '../core/constants.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 经典泡泡模式 (Pop Mode)
 * 玩法：限时 90 秒，尽可能戳破更多泡泡，避开炸弹。
 * 特殊道具：核弹（全屏消除）、冰冻（减速）、磁铁（自动吸附）。
 */
export class PopMode extends BaseGameMode {
    constructor(deps) {
        super(deps);
        this.onGameOver = deps.onGameOver;
        this.comboCount = 0;
        this.comboTimerId = null;
    }

    onEnter() {
        if (gameState.playerCount === 2) {
            gameState.player1Lives = 3;
            gameState.player2Lives = 3;
        } else {
            gameState.lives = 3;
        }
        this.comboCount = 0;
        gameState.feverMode = false;
        this.comboDisplay.hide();
    }

    createTarget() {
        return new PopBubbleTarget();
    }

    /**
     * 动态计算生成速度
     * 随着时间推移，泡泡生成得越来越快，增加难度。
     */
    getSpawnInterval(now) {
        const elapsed = now - gameState.gameStartTime;
        const timeLimit = 90000;
        const progress = elapsed / timeLimit;
        // 基础间隔减去进度带来的加速，最快 400ms 生成一个
        const currentSpawnInterval = Math.max(400, SPAWN_INTERVAL - (progress * 600));
        return currentSpawnInterval / gameState.speedMultiplier;
    }

    /**
     * 绘制剩余时间倒计时
     */
    drawHud(ctx, now) {
        const canvas = getCanvas();
        const elapsed = now - gameState.gameStartTime;
        const timeLimit = 90000;
        const remaining = Math.max(0, timeLimit - elapsed);

        const seconds = Math.ceil(remaining / 1000);
        const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // 画背景框
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.roundRect(canvas.width / 2 - 50, 10, 100, 40, 10);
        ctx.fill();

        // 时间少于 10 秒变红提醒
        ctx.fillStyle = remaining < 10000 ? '#FF5555' : '#FFF';
        ctx.font = 'bold 24px "Varela Round", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${mm}:${ss}`, canvas.width / 2, 30);
        ctx.restore();

        if (remaining <= 0) {
            this.onGameOver();
        }
    }

    handleCollision(t, player = 1) {
        const canvas = getCanvas();
        // 计算视觉坐标（修复镜像问题）
        const visualX = canvas.width - t.x;
        
        // 碰到炸弹：扣分、屏幕震动、断连击
        if (t.type === 'bomb') {
            playSound(100);
            const container = document.querySelector('.game-container');
            if(container) {
                container.classList.add('shake');
                container.classList.add('flash-red');
                setTimeout(() => {
                    container.classList.remove('shake');
                    container.classList.remove('flash-red');
                }, 500);
            }

            // 扣除生命值 logic
            if (gameState.playerCount === 2) {
                 if (player === 1) gameState.player1Lives--;
                 else gameState.player2Lives--;
                 
                 gameState.floatingTexts.push(new FloatingText(visualX, t.y, "HP -1", "#FF0000"));

                 if (gameState.player1Lives <= 0 || gameState.player2Lives <= 0) {
                     this.onGameOver();
                     return true;
                 }
            } else {
                 gameState.lives--;
                 gameState.floatingTexts.push(new FloatingText(visualX, t.y, "HP -1", "#FF0000"));
                 if (gameState.lives <= 0) {
                     this.onGameOver();
                     return true;
                 }
            }

            const newScore = Math.max(0, this.scoreManager.get(player) - 50);
            this.scoreManager.set(player, newScore);

            const targetScoreEl = (gameState.playerCount === 2 && player === 2) ? document.getElementById('score-p2') : document.getElementById('score');
            if(targetScoreEl) {
                targetScoreEl.style.color = '#FF0000';
                setTimeout(() => targetScoreEl.style.color = '#FFF', 500);
            }
            // gameState.floatingTexts.push(new FloatingText(t.x, t.y, "-50", "#FF0000")); // 已在上方显示 HP -1，这里不再重复显示 -50，或者可以都显示

            this.comboCount = 0;
            gameState.feverMode = false;
            this.comboDisplay.hide();
            return true;
        }

        // 碰到核弹：全屏消除
        if (t.type === 'nuke') {
            playSound(200, 'square');
            let pointsGained = 0;
            let particleCount = 0;
            
            // 消除所有普通泡泡
            gameState.targets.forEach(target => {
                 if (target.type !== 'bomb' && target.type !== 'nuke') {
                     pointsGained += 10;
                     particleCount++;
                     spawnParticles(target.x, target.y, target.color || '#FFF');
                 }
            });
            
            this.scoreManager.add(player, pointsGained);
            gameState.floatingTexts.push(new FloatingText(canvas.width/2, canvas.height/2, "NUKE CLEAR!", "#FF4500"));
            
            // 返回特殊指令 'nuke_clear'，让主循环处理消除逻辑
            return 'nuke_clear';
        }

        // 碰到冰冻：减慢时间
        if (t.type === 'freeze') {
             playSound(600, 'sine');
             gameState.speedMultiplier = 0.5; // 速度减半
             gameState.floatingTexts.push(new FloatingText(visualX, t.y, "FREEZE!", "#00FFFF"));
             document.body.style.filter = "brightness(1.2) hue-rotate(180deg)"; // 画面变蓝
             setTimeout(() => {
                 gameState.speedMultiplier = 1.0;
                 document.body.style.filter = "none";
             }, 5000); // 持续 5 秒
             return true;
        }

        // 普通泡泡逻辑...
        const points = (t.type === 'gold') ? 50 : 10;
        this.comboCount++;
        // 连击越高，分数加成越高
        const comboMultiplier = 1 + (Math.floor(this.comboCount / 5) * 0.1);
        const finalPoints = Math.floor(points * comboMultiplier);
        
        if (this.comboCount > 1) {
            this.comboDisplay.show(this.comboCount, false);
        }
        
        if (this.comboTimerId) clearTimeout(this.comboTimerId);
        this.comboTimerId = setTimeout(() => {
            this.comboCount = 0;
            this.comboDisplay.hide();
        }, 3000);

        const soundFreq = Math.min(800, 300 + (this.comboCount * 20));
        playSound(soundFreq, t.type === 'gold' ? 'sine' : 'triangle');
        
        spawnParticles(visualX, t.y, t.color || '#FFF');
        gameState.floatingTexts.push(new FloatingText(visualX, t.y, `+${finalPoints}`, "#FFF"));
        
        if (t.type === 'gold') {
             gameState.floatingTexts.push(new FloatingText(visualX, t.y - 30, "GOLD!", "#FFD700"));
        }

        this.scoreManager.add(player, finalPoints);
        return true;
    }
}
