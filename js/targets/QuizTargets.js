import { BaseTarget } from './BaseTarget.js';
import { gameState } from '../core/gameState.js';
import { drawBubbleBody, drawBubbleIcon, drawWordOverlay } from '../utils/drawing.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 问答模式的选项泡泡 (QuizOptionTarget)
 * 承载一个汉字选项，可能是正确答案，也可能是干扰项。
 */
export class QuizOptionTarget extends BaseTarget {
    constructor(charData, isCorrect, xPos, isVoiceTarget = false) {
        const canvas = getCanvas();
        super({ radius: 75, x: xPos, y: canvas.height + 75 }); // 半径放大 60 -> 75
        this.vx = 0;
        this.vy = -3 * gameState.speedMultiplier; // 向上飘
        this.type = 'quiz';
        this.isQuizAnswer = isCorrect; // 标记是否为正确答案
        this.isVoiceTarget = isVoiceTarget; // 标记是否为语音泡泡
        this.isWaitingForVoice = false; // 是否处于等待语音输入状态
        this.char = charData.汉字;
        this.pinyin = charData.拼音;
        this.word = charData.组词;
        this.hue = Math.random() * 360;
        this.color = `hsl(${this.hue}, 80%, 90%)`;
        this.feedbackText = ""; // 实时语音反馈文本
    }

    update() {
        if (this.shouldRemove) return false;
        
        // 如果正在等待语音，停止移动
        if (this.isWaitingForVoice) {
            return true;
        }

        const speedFactor = this.getSpeedFactor();
        const canvas = getCanvas();

        this.x += this.vx * speedFactor;
        this.y += this.vy * speedFactor;

        // 碰到上下边缘反弹，保持在屏幕内飘动
        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy = Math.abs(this.vy);
        }
        if (this.y > canvas.height - this.radius) {
            this.y = canvas.height - this.radius;
            this.vy = -Math.abs(this.vy);
        }

        // 碰到左右边缘反弹
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx);
        } else if (this.x > canvas.width - this.radius) {
            this.x = canvas.width - this.radius;
            this.vx = -Math.abs(this.vx);
        }

        return true;
    }

    draw(ctx) {
        // 如果处于“暗示状态”，画一个光环
        if (this.isHinted && !this.isWaitingForVoice) {
             ctx.save();
             ctx.beginPath();
             // 呼吸效果的光环
             const pulse = Math.sin(Date.now() / 200) * 5;
             ctx.arc(this.x, this.y, this.radius + 10 + pulse, 0, Math.PI * 2);
             ctx.strokeStyle = "rgba(255, 215, 0, 0.8)"; // 金色光环
             ctx.lineWidth = 5;
             ctx.stroke();
             
             // 内部也稍微亮一点
             ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
             ctx.fill();
             ctx.restore();
        }

        // 语音解锁状态：黄金高亮 + 脉冲 + 变大 (背景光晕)
        if (this.isWaitingForVoice) {
             ctx.save();
             // 强烈脉冲
             const pulse = Math.sin(Date.now() / 100) * 10;
             const glowRadius = this.radius + 15 + Math.abs(pulse);
             
             // 黄金光晕
             const gradient = ctx.createRadialGradient(this.x, this.y, this.radius, this.x, this.y, glowRadius);
             gradient.addColorStop(0, "rgba(255, 223, 0, 0.2)");
             gradient.addColorStop(1, "rgba(255, 223, 0, 0.8)");
             
             ctx.beginPath();
             ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
             ctx.fillStyle = gradient;
             ctx.fill();
             
             // 边框
             ctx.strokeStyle = "#FFD700";
             ctx.lineWidth = 8;
             ctx.stroke();
             ctx.restore();
        }

        // 先绘制泡泡主体和内容
        const shouldContinue = drawBubbleBody(ctx, this);
        if (shouldContinue) drawBubbleIcon(ctx, this);
        drawWordOverlay(ctx, this);

        // 最后绘制麦克风相关UI，确保在最上层
        if (this.isVoiceTarget) {
            if (this.isWaitingForVoice) {
                 ctx.save();
                 // 临时解除镜像，让文字正常显示 (Translate + Scale -1)
                 ctx.translate(this.x, this.y);
                 ctx.scale(-1, 1);
                 
                 // 麦克风图标提示 (在泡泡上方)
                 ctx.font = "40px Arial";
                 ctx.textAlign = "center";
                 ctx.textBaseline = "bottom";
                 ctx.fillStyle = "#FFF";
                 ctx.shadowColor = "black";
                 ctx.shadowBlur = 4;
                 // 闪烁效果
                 if (Math.floor(Date.now() / 500) % 2 === 0) {
                     // 坐标变为相对于圆心 (0, 0)
                     ctx.fillText("🎤 大声读！", 0, -this.radius - 20);
                 }

                 // 实时反馈文本 (一直显示，不闪烁)
                 if (this.feedbackText) {
                     ctx.font = "24px Arial";
                     ctx.fillStyle = "#FFD700"; // 金色
                     ctx.fillText(this.feedbackText, 0, -this.radius - 60); // 在“大声读”上方
                 }

                 ctx.restore();
            } else {
                 // 语音泡泡的基础标记 (静止状态)
                 ctx.save();
                 // 临时解除镜像
                 ctx.translate(this.x, this.y);
                 ctx.scale(-1, 1);
                 
                 ctx.font = "bold 30px Arial"; // 加大字体
                 ctx.fillStyle = "#FF4500"; // 改为橙红色，更显眼
                 ctx.textAlign = "center";
                 ctx.textBaseline = "middle";
                 // 放在泡泡左上角 (注意解除镜像后，X轴方向变了，所以偏移量要反过来？)
                 // 原来是 this.x + offset (Screen Left).
                 // 现在 0 - offset (Screen Left).
                 ctx.fillText("🎤", -this.radius * 0.6, -this.radius * 0.6);
                 ctx.restore();
            }
        }
        
        ctx.shadowBlur = 0;
    }
}

/**
 * 问答模式的陷阱炸弹 (QuizBombTarget)
 * 选错了会扣分或扣命。
 */
export class QuizBombTarget extends BaseTarget {
    constructor() {
        const canvas = getCanvas();
        super({ radius: 45 });
        this.radius = 45;
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = canvas.height + this.radius;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = -(2.5 + Math.random() * 2);
        this.type = 'bomb';
        this.isQuizAnswer = false;
        this.hue = 0;
        this.color = '#FF4444';
    }

    update() {
        const speedFactor = this.getSpeedFactor();
        const canvas = getCanvas();

        this.x += this.vx * speedFactor;
        this.y += this.vy * speedFactor;

        // 在屏幕内反弹
        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy = Math.abs(this.vy);
        }
        if (this.y > canvas.height - this.radius) {
            this.y = canvas.height - this.radius;
            this.vy = -Math.abs(this.vy);
        }
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx);
        } else if (this.x > canvas.width - this.radius) {
            this.x = canvas.width - this.radius;
            this.vx = -Math.abs(this.vx);
        }
        return true;
    }

    draw(ctx) {
        const shouldContinue = drawBubbleBody(ctx, this);
        if (!shouldContinue) return;
        drawBubbleIcon(ctx, this);
    }
}

/**
 * 问答模式的护盾道具 (QuizShieldTarget)
 * 吃了可以抵消一次错误。
 */
export class QuizShieldTarget extends BaseTarget {
     constructor() {
        const canvas = getCanvas();
        super({ radius: 40 });
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = canvas.height + this.radius;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = -(3 + Math.random() * 2);
        this.type = 'shield';
        this.hue = 180;
        this.color = '#00FFFF';
    }
    
    update() {
         // 复用 Bomb 的反弹逻辑，或者简写
         return new QuizBombTarget().update.call(this);
    }
    
    draw(ctx) {
         const shouldContinue = drawBubbleBody(ctx, this);
         if (!shouldContinue) return;
         drawBubbleIcon(ctx, this);
         ctx.shadowBlur = 0;
    }
}
