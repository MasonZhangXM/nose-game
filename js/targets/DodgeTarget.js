import { BaseTarget } from './BaseTarget.js';
import { gameState } from '../core/gameState.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 躲避模式的目标 (DodgeTarget)
 * 包含陨石（要躲开）和星星（要收集）。
 */
export class DodgeTarget extends BaseTarget {
    constructor() {
        super();
        this.initDodge();
        this.shouldRemove = false; // 新增：标记是否应被移除（如被大招清除）
    }

    /**
     * 初始化：从天而降
     */
    initDodge() {
        const canvas = getCanvas();
        this.radius = 30 + Math.random() * 30; // 随机大小
        // 随机横坐标
        this.x = Math.random() * (canvas.width * 0.9) + (canvas.width * 0.05);
        this.y = -this.radius; // 从屏幕上方开始

        const rand = Math.random();
        if (rand > 0.9) {
            // 10% 几率是特殊道具
            const itemRand = Math.random();
            if (itemRand < 0.25) {
                this.type = 'health'; // 加血
                this.text = '❤️';
            } else if (itemRand < 0.5) {
                this.type = 'shield'; // 护盾
                this.text = '🛡️';
            } else if (itemRand < 0.75) {
                this.type = 'slowmo'; // 减速
                this.text = '⏱️';
            } else {
                this.type = 'bomb'; // 全屏清除
                this.text = '💣';
            }
            this.color = '#FFFFFF';
            // 道具掉落速度稍慢
            this.speedY = -(2 + Math.random() * 2) * gameState.speedMultiplier; 
        } else if (rand > 0.75) {
            // 15% 几率是星星（奖励）
            this.type = 'star';
            this.color = '#FFFF00';
            this.speedY = -(3 + Math.random() * 2) * gameState.speedMultiplier; 
        } else {
            // 75% 几率是陨石（障碍）
            this.type = 'meteor';
            this.color = '#888888';
            this.speedY = -(5 + Math.random() * 4) * gameState.speedMultiplier;
        }
    }

    update() {
        if (this.shouldRemove) return false; // 如果被标记移除，直接返回 false
        const speedFactor = this.getSpeedFactor();
        const canvas = getCanvas();

        // 这里的 speedY 是负数，所以 -= 是向下移动
        this.y -= this.speedY * speedFactor;
        // 左右微微晃动
        this.x += Math.sin((Date.now() / 400) + this.wobbleOffset) * 0.5;

        // 掉出屏幕下方就销毁
        if (this.y > canvas.height + this.radius) {
            return false;
        }
        return true;
    }

    draw(ctx) {
        if (this.type === 'meteor') {
            // 画陨石：灰色渐变球体 + 坑坑洼洼的效果
            const grad = ctx.createRadialGradient(
                this.x - this.radius * 0.2, this.y - this.radius * 0.2, 0,
                this.x, this.y, this.radius
            );
            grad.addColorStop(0, '#888');
            grad.addColorStop(0.5, '#555');
            grad.addColorStop(1, '#333');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
            ctx.fill();

            // 画陨石坑
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.arc(this.x - 10, this.y - 10, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + 15, this.y + 5, 6, 0, 2 * Math.PI);
            ctx.fill();

            // 画一点高光轮廓
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x - 10, this.y - 10, 8, 0, 2 * Math.PI);
            ctx.stroke();
            return;
        }

        if (this.type === 'star') {
            // 画星星：发光的五角星
            ctx.shadowColor = '#FFFF00';
            ctx.shadowBlur = 30;
            ctx.fillStyle = '#FFF700';

            const spikes = 5;
            const outer = this.radius;
            const inner = this.radius * 0.4;
            let rot = Math.PI / 2 * 3;
            let x = this.x;
            let y = this.y;
            const step = Math.PI / spikes;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y - outer);
            for (let i = 0; i < spikes; i++) {
                x = this.x + Math.cos(rot) * outer;
                y = this.y + Math.sin(rot) * outer;
                ctx.lineTo(x, y);
                rot += step;

                x = this.x + Math.cos(rot) * inner;
                y = this.y + Math.sin(rot) * inner;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.lineTo(this.x, this.y - outer);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
        }

        if (['health', 'shield', 'slowmo', 'bomb'].includes(this.type)) {
            // 绘制道具：气泡 + Emoji
            ctx.save();
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 15;
            
            // 1. 气泡背景
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
            ctx.fill();
            
            // 2. 边框
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 3. Emoji 图标
            ctx.font = `${this.radius * 1.2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.text, this.x, this.y + this.radius * 0.1);
            
            ctx.restore();
        }
    }
}
