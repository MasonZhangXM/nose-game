import { BaseGameMode } from './BaseGameMode.js';
import { JuggleBallTarget } from '../targets/JuggleBallTarget.js';
import { gameState } from '../core/gameState.js';
import { playSound } from '../utils/audio.js';
import { spawnParticles } from '../visuals/ParticleSystem.js';

/**
 * 颠球模式 (Juggle Mode) - 现已升级为“膝盖颠球”
 * 玩法：用膝盖（或身体其他部位）顶球，不让球落地。
 * 核心机制：
 * 1. 物理模拟：球有重力，会下落，碰到身体会反弹。
 * 2. 挑战任务：游戏会随机指定“左膝”或“右膝”，用指定部位顶球得分更高。
 * 3. 道具系统：可能会掉落“大脚板”道具，让你的判定范围变大，更容易接到球。
 */
export class JuggleMode extends BaseGameMode {
    constructor(deps) {
        super(deps);
        this.comboCount = 0; // 连击计数（连续顶球次数）
        this.lastHitTime = 0; // 上次顶球的时间
        
        // --- 双膝挑战逻辑 ---
        // 游戏会指挥你：“左边！”、“右边！”，增加趣味性
        this.targetKnee = null; // 当前目标：'left' (左) 或 'right' (右)
        this.nextChallengeTime = 0; // 下一次切换指令的时间
        
        // --- 大脚板道具 (Big Foot Power-up) ---
        // 吃到这个道具后，你的“脚”（或膝盖）会变大，更容易碰到球
        this.bigFootTimer = 0; // 道具效果结束的时间点
        gameState.juggleHitRadiusBonus = 0; // 额外的碰撞半径（变大多少）
    }

    /**
     * 生成控制逻辑：始终保持场上有一个球
     * 如果球掉了，立即生成新的
     */
    getSpawnInterval(now) {
        if (gameState.targets.length === 0) {
            return 500; // 场上没球时，0.5秒后生成
        }
        return null; // 场上有球时，不生成新球
    }

    /**
     * 生成一个足球
     */
    createTarget() {
        // 重置状态
        this.comboCount = 0;
        this.targetKnee = null;
        gameState.juggleHitRadiusBonus = 0;
        return new JuggleBallTarget();
    }
    
    update(now) {
        // --- 双膝挑战逻辑更新 ---
        // 每隔 5 秒切换一次指定膝盖
        if (now > this.nextChallengeTime) {
            this.targetKnee = Math.random() < 0.5 ? 'left' : 'right';
            this.nextChallengeTime = now + 5000;
        }

        // --- 大脚板道具逻辑 ---
        if (gameState.juggleHitRadiusBonus > 0) {
            if (now > this.bigFootTimer) {
                gameState.juggleHitRadiusBonus = 0; // 道具过期
            }
        } else {
            // 随机掉落判定 (每帧极低概率，约 10秒一次)
            if (Math.random() < 0.002) {
                this.activateBigFoot(now);
            }
        }
    }

    activateBigFoot(now) {
        gameState.juggleHitRadiusBonus = 50; // 判定半径增加 50
        this.bigFootTimer = now + 10000; // 持续 10 秒
        
        // 视觉提示
        gameState.floatingTexts.push({
            x: window.innerWidth / 2, 
            y: window.innerHeight / 2,
            text: '🦶 大脚板模式! 🦶',
            life: 100,
            vy: -2,
            color: '#00FF00',
            update: function() { this.y += this.vy; this.life--; },
            draw: function(ctx) {
                ctx.fillStyle = this.color;
                ctx.font = 'bold 40px Arial';
                ctx.fillText(this.text, this.x - 150, this.y);
            }
        });
    }

    /**
     * 处理碰撞（顶球）
     * @param {object} t 足球对象
     * @param {number} player 玩家编号
     * @param {object} hitPoint 碰撞点
     */
    handleCollision(t, player = 1, hitPoint = null) {
        if (!hitPoint) return false;
        
        // 只有球在下落时顶它才有效 (vy > 0)
        if (t.vy > 0) {
            t.vy = -20; // 给球一个向上的速度 (膝盖颠球需要更高的高度，原为 -12)
            // 根据击球位置改变水平速度（模拟物理反弹）
            // 如果顶在球的左边，球会向右飞；顶在右边，向左飞
            t.vx += (t.x - hitPoint.x) * 0.3; // 增加水平反弹力度 (原 0.2)

            // --- 连击判定 ---
            const now = Date.now();
            if (now - this.lastHitTime < 2000) { // 2秒内接球算连击
                this.comboCount++;
            } else {
                this.comboCount = 1;
            }
            this.lastHitTime = now;

            // 火球状态
            if (this.comboCount >= 5) {
                t.isFireball = true;
            } else {
                t.isFireball = false;
            }

            // --- 分数计算 ---
            let points = 1;
            
            // 1. 火球翻倍
            if (t.isFireball) points *= 2;
            
            // 2. 双膝挑战判定
            let isCorrectKnee = true;
            if (this.targetKnee && hitPoint.part) {
                if (hitPoint.part === this.targetKnee) {
                    points += 5; // 奖励分
                    // 飘字提示 Good!
                    gameState.floatingTexts.push({
                         x: t.x, y: t.y - 50, text: '完美! +5', life: 50, vy: -1, color: '#00FF00',
                         update: function() { this.y += this.vy; this.life--; },
                         draw: function(ctx) { ctx.fillStyle = this.color; ctx.fillText(this.text, this.x, this.y); }
                    });
                } else {
                    // 用错膝盖，只得基础分 (不惩罚，只少给分)
                    isCorrectKnee = false;
                    gameState.floatingTexts.push({
                         x: t.x, y: t.y - 50, text: '换个腿! +1', life: 50, vy: -1, color: '#FFA500',
                         update: function() { this.y += this.vy; this.life--; },
                         draw: function(ctx) { ctx.fillStyle = this.color; ctx.fillText(this.text, this.x, this.y); }
                    });
                }
            }

            // 更新分数
            if (gameState.playerCount === 2) {
                if (player === 1) {
                    gameState.player1Score += points;
                    const el = document.getElementById('score');
                    if (el) el.innerText = gameState.player1Score;
                } else {
                    gameState.player2Score += points;
                    const el = document.getElementById('score-p2');
                    if (el) el.innerText = gameState.player2Score;
                }
            } else {
                gameState.score += points;
                const el = document.getElementById('score');
                if (el) el.innerText = gameState.score;
            }

            // 播放音效，音调随着分数变高，增加趣味性
            playSound(300 + (gameState.score * 10), 'sine');
            spawnParticles(t.x, t.y + t.radius, t.isFireball ? '#FF4500' : '#FFF');
        }
        return false; // 顶球后球不会消失，所以返回 false
    }

    drawHud(ctx, now) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        
        // 绘制双膝挑战提示
        if (this.targetKnee) {
            ctx.save();
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            
            const text = this.targetKnee === 'left' ? '⬅️ 用左膝盖!' : '用右膝盖! ➡️';
            const x = w / 2;
            const y = 150;
            
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
            
            // 绘制膝盖图标提示 (简单的圆圈示意)
            ctx.beginPath();
            ctx.arc(this.targetKnee === 'left' ? w * 0.3 : w * 0.7, h * 0.8, 40, 0, Math.PI*2);
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.fill();
            
            ctx.restore();
        }

        // 绘制连击提示
        if (this.comboCount > 1) {
             ctx.save();
             ctx.font = 'bold 30px Arial';
             ctx.fillStyle = this.comboCount >= 5 ? '#FF4500' : '#FFFF00';
             ctx.fillText(`连击: ${this.comboCount}`, 20, 100);
             if (this.comboCount >= 5) {
                 ctx.fillText(`🔥 火力全开! (x2)`, 20, 140);
             }
             ctx.restore();
        }

        // 绘制大脚板剩余时间
        if (gameState.juggleHitRadiusBonus > 0) {
            const timeLeft = Math.ceil((this.bigFootTimer - now) / 1000);
            ctx.save();
            ctx.font = 'bold 30px Arial';
            ctx.fillStyle = '#00FF00';
            ctx.fillText(`🦶 大脚板: ${timeLeft}s`, 20, 180);
            ctx.restore();
        }
    }
}
