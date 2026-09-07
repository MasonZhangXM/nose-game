import { BaseGameMode } from './BaseGameMode.js';
import { DodgeTarget } from '../targets/DodgeTarget.js';
import { gameState } from '../core/gameState.js';
import { playSound } from '../utils/audio.js';
import { FloatingText } from '../visuals/FloatingText.js';
import { spawnParticles } from '../visuals/ParticleSystem.js';

/**
 * 躲避模式 (Dodge Mode)
 * 玩法：控制角色躲避从天而降的陨石，同时收集星星和道具。
 * 核心机制：
 * 1. 左右移动身体来控制角色。
 * 2. “深蹲”可以蓄力，蓄力满后释放全屏冲击波（大招）。
 * 3. 吃到不同的道具会有不同的效果（如护盾、慢动作）。
 */
export class DodgeMode extends BaseGameMode {
    constructor(deps) {
        super(deps);
        this.onGameOver = deps.onGameOver;
        
        // --- 超级大招状态 (Super Move State) ---
        // 就像游戏里的“必杀技”，需要先攒气（蓄力），攒满了才能放。
        this.isCrouching = false;    // 玩家是否正在蹲下
        this.chargeStartTime = 0;    // 开始蹲下的时间点
        this.chargeProgress = 0;     // 蓄力进度 (0.0 到 1.0，1.0表示满了)
        this.canBlast = false;       // 是否蓄力完成，准备好释放了
        this.blastActive = false;    // 冲击波是否正在扩散（大招释放中）
        this.blastRadius = 0;        // 冲击波当前的半径
        
        // --- 阈值配置 (Settings) ---
        // 什么时候算蹲下？肩膀位置超过屏幕高度的 75% 就算蹲下。
        // (坐标系：0在顶部，1在底部，所以越大越靠下)
        this.SHOULDER_Y_THRESHOLD = 0.75; 
        
        // 蓄力需要多久？这里设置的是 2000毫秒 (2秒)
        this.CHARGE_TIME = 2000; 

        // --- 道具状态 ---
        this.shieldActive = false; // 是否有护盾保护
        this.slowMoEndTime = 0;    // 慢动作效果什么时候结束
    }

    /**
     * 进入模式时初始化
     */
    onEnter() {
        gameState.lives = 3; // 初始 3 条命
        gameState.timeScale = 1.0;
        this.shieldActive = false;
        this.slowMoEndTime = 0;
        this.resetChargeState();
    }
    
    resetChargeState() {
        this.isCrouching = false;
        this.chargeStartTime = 0;
        this.chargeProgress = 0;
        this.canBlast = false;
        this.blastActive = false;
        this.blastRadius = 0;
    }

    /**
     * 每帧更新：检测蹲下动作，处理大招逻辑
     */
    update(now) {
        // 0. 处理慢动作
        if (now < this.slowMoEndTime) {
            gameState.timeScale = 0.5;
        } else {
            gameState.timeScale = 1.0;
        }

        // 1. 冲击波扩散逻辑
        if (this.blastActive) {
            this.blastRadius += 30; // 扩散速度
            // 清除范围内的陨石
            const canvas = document.getElementsByClassName('output_canvas')[0];
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            
            gameState.targets.forEach(t => {
                if (t.type === 'meteor' && !t.shouldRemove) {
                    const dx = t.x - cx;
                    const dy = t.y - cy;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < this.blastRadius) {
                        t.shouldRemove = true; // 标记移除
                        spawnParticles(t.x, t.y, '#00FFFF', 10); // 青色爆炸
                        this.scoreManager.add(1, 20); // 炸毁一个加 20 分
                    }
                }
            });

            // 扩散到全屏后结束
            if (this.blastRadius > Math.max(canvas.width, canvas.height)) {
                this.blastActive = false;
            }
        }

        // 2. 检测蹲下逻辑 (基于 gameState.player1Pos)
        // 注意：Dodge 模式下 main.js 会把核心点写入 activePoints 并更新 player1Pos
        // 但我们需要更原始的肩膀数据。
        // 为了方便，我们在 main.js 把肩膀的 Y 坐标存入 gameState 一个临时字段，或者直接在这里访问 gameState.player1Pos.y
        
        // gameState.player1Pos.y 是屏幕像素坐标。需要转换回 0~1 的比例。
        const canvas = document.getElementsByClassName('output_canvas')[0];
        if (!canvas) return;
        
        if (gameState.player1Pos) {
            const relativeY = gameState.player1Pos.y / canvas.height;
            
            // 判定蹲下
            if (relativeY > this.SHOULDER_Y_THRESHOLD) {
                if (!this.isCrouching) {
                    this.isCrouching = true;
                    this.chargeStartTime = now;
                    // playSound(400, 'triangle'); // 开始蓄力音效
                }
                
                // 计算蓄力进度
                const duration = now - this.chargeStartTime;
                this.chargeProgress = Math.min(1.0, duration / this.CHARGE_TIME);
                
                if (this.chargeProgress >= 1.0 && !this.canBlast) {
                    this.canBlast = true;
                    playSound(600, 'square'); // 蓄力完成提示音
                    gameState.floatingTexts.push(new FloatingText(gameState.player1Pos.x, gameState.player1Pos.y - 100, "READY!", "#00FFFF"));
                }
            } else {
                // 判定站起 (释放大招)
                if (this.isCrouching) {
                    if (this.canBlast) {
                        // 释放大招！
                        this.triggerBlast();
                    } else {
                        // 蓄力未完成就站起，取消
                        this.chargeProgress = 0;
                    }
                    this.isCrouching = false;
                    this.canBlast = false;
                }
            }
        }
    }
    
    triggerBlast() {
        this.blastActive = true;
        this.blastRadius = 0;
        this.chargeProgress = 0;
        
        playSound(200, 'sawtooth'); // 释放音效 (低沉有力)
        // 屏幕震动
        const container = document.querySelector('.game-container');
        if(container) {
            container.classList.add('shake');
            setTimeout(() => container.classList.remove('shake'), 500);
        }
        gameState.floatingTexts.push(new FloatingText(gameState.player1Pos.x, gameState.player1Pos.y - 100, "BOOM!!!", "#FFD700"));
    }

    /**
     * 绘制 UI：血条 + 蓄力条
     */
    drawHud(ctx, now) {
        const canvas = document.getElementsByClassName('output_canvas')[0];
        
        // 绘制血条背景
        const barWidth = 300;
        const barHeight = 30;
        const x = (canvas.width - barWidth) / 2;
        const y = 30;
        
        ctx.save();
        // 确保坐标系是标准的 (不受镜像影响)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // 1. 背景槽
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 15);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
        ctx.stroke();
        
        // 2. 血条填充
        const maxLives = 5; // 上限改为 5
        const percentage = Math.max(0, gameState.lives / maxLives);
        const fillWidth = Math.max(0, (barWidth - 6) * percentage);
        
        // 颜色渐变 (红 -> 黄 -> 绿)
        let color = '#00FF00';
        if (percentage <= 0.2) color = '#FF0000';
        else if (percentage <= 0.5) color = '#FFFF00';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x + 3, y + 3, fillWidth, barHeight - 6, 12);
        } else {
            ctx.rect(x + 3, y + 3, fillWidth, barHeight - 6);
        }
        ctx.fill();
        
        // 3. 文字标签
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 20px "Varela Round", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(`HP: ${gameState.lives}`, x + barWidth / 2, y + barHeight / 2);
        
        // --- 道具状态 UI ---
        // 护盾图标
        if (this.shieldActive) {
            ctx.font = '30px Arial';
            ctx.fillText("🛡️", x - 30, y + barHeight/2);
            
            // 玩家身上的护盾光圈
            if (gameState.player1Pos) {
                const px = gameState.player1Pos.x;
                const py = gameState.player1Pos.y;
                
                ctx.save();
                ctx.translate(px, py);
                // 旋转动效
                ctx.rotate(now / 500);
                
                ctx.beginPath();
                ctx.arc(0, 0, 80, 0, 2 * Math.PI);
                ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 10]); // 虚线效果
                ctx.stroke();
                
                ctx.restore();
            }
        }
        
        // 慢动作提示
        if (gameState.timeScale < 1.0) {
            ctx.fillStyle = '#00FF00';
            ctx.font = 'bold 20px Arial';
            ctx.fillText("⏱️ SLOW", x + barWidth + 50, y + barHeight/2);
        }

        // 4. 蓄力进度条 (当正在蹲下时显示)
        if (this.isCrouching) {
            const cx = gameState.player1Pos ? gameState.player1Pos.x : canvas.width/2;
            const cy = gameState.player1Pos ? gameState.player1Pos.y : canvas.height/2;
            
            // 在角色上方绘制环形进度条
            const radius = 60;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.lineWidth = 8;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(cx, cy, radius, -Math.PI/2, -Math.PI/2 + this.chargeProgress * 2 * Math.PI);
            ctx.lineWidth = 8;
            ctx.strokeStyle = this.canBlast ? '#FF00FF' : '#00FFFF'; // 蓄满变紫色
            ctx.stroke();
            
            if (this.canBlast) {
                 ctx.fillStyle = '#FF00FF';
                 ctx.font = 'bold 16px Arial';
                 ctx.fillText("STAND UP!", cx, cy - radius - 15);
            }
        }

        // 5. 冲击波特效
        if (this.blastActive) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            
            ctx.beginPath();
            ctx.arc(cx, cy, this.blastRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 20;
            ctx.stroke();
            
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#00FFFF';
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();
    }

    /**
     * 生成目标（陨石或星星）
     */
    createTarget() {
        return new DodgeTarget();
    }

    /**
     * 处理碰撞逻辑
     * @param {object} t 目标对象
     */
    handleCollision(t) {
        // 1. 陨石 (障碍)
        if (t.type === 'meteor') {
            if (this.shieldActive) {
                // 护盾抵消
                this.shieldActive = false;
                playSound(400, 'square'); // 护盾破碎音效
                spawnParticles(t.x, t.y, '#FFFFFF', 15);
                gameState.floatingTexts.push(new FloatingText(t.x, t.y, "BLOCKED!", "#FFFFFF"));
            } else {
                // 扣血
                playSound(100); 
                document.body.classList.add('shake'); // 屏幕震动效果
                setTimeout(() => document.body.classList.remove('shake'), 500);

                gameState.lives--; // 扣血
                // 飘字提示
                gameState.floatingTexts.push(new FloatingText(t.x, t.y, "HIT! -1 Life", "#FF0000"));

                // 如果没血了，游戏结束
                if (gameState.lives <= 0) this.onGameOver();
            }
        } 
        // 2. 星星 (得分)
        else if (t.type === 'star') {
            this.scoreManager.add(1, 100); // 加 100 分
            playSound(800, 'sine'); // 播放星星音效
            spawnParticles(t.x, t.y, '#FFFF00'); // 播放粒子特效
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "+100", "#FFFF00"));
        }
        // 3. 道具：加血
        else if (t.type === 'health') {
            gameState.lives = Math.min(gameState.lives + 1, 5); // 上限 5
            playSound(600, 'sine');
            spawnParticles(t.x, t.y, '#FF0000');
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "+1 HP", "#FF0000"));
        }
        // 4. 道具：护盾
        else if (t.type === 'shield') {
            this.shieldActive = true;
            playSound(600, 'square');
            spawnParticles(t.x, t.y, '#0000FF');
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "SHIELD UP!", "#0000FF"));
        }
        // 5. 道具：慢动作
        else if (t.type === 'slowmo') {
            this.slowMoEndTime = Date.now() + 5000; // 5秒
            playSound(300, 'triangle');
            spawnParticles(t.x, t.y, '#00FF00');
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "SLOW MO!", "#00FF00"));
        }
        // 6. 道具：炸弹
        else if (t.type === 'bomb') {
            this.triggerBlast();
            spawnParticles(t.x, t.y, '#FF8800');
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "BOOM!", "#FF8800"));
        }
        
        return true; // 碰撞后移除目标
    }
}
