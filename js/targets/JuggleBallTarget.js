import { BaseTarget } from './BaseTarget.js';
import { gameState } from '../core/gameState.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 颠球模式的目标 (JuggleBallTarget)
 * 一个受重力影响的足球。
 */
export class JuggleBallTarget extends BaseTarget {
    constructor() {
        super();
        const canvas = getCanvas();
        this.radius = 40;
        // 增加安全检查：如果 Canvas 还没准备好，默认放在屏幕中间 (假设 1280 宽)
        const w = (canvas && canvas.width) ? canvas.width : 1280;
        this.x = w / 2;
        this.y = 100; // 从上方出现
        this.vx = (Math.random() - 0.5) * 5; // 随机水平初速度
        this.vy = 0; // 垂直初速度为 0
        this.gravity = 0.4; // 稍微降低重力，让球更“飘”，方便小朋友接球 (原 0.5)
        this.friction = 0.99; // 空气阻力
        this.type = 'ball';
        this.color = '#FFFFFF';
        
        // --- 增强属性 ---
        this.hitRadius = this.radius + 20; // 实际判定半径比视觉大，降低难度
        this.isFireball = false; // 是否开启火焰特效
    }

    update() {
        const speedFactor = this.getSpeedFactor();
        const canvas = getCanvas();

        // 物理模拟
        this.vy += this.gravity; // 速度增加（下落）
        this.vx *= this.friction; // 水平速度衰减
        
        // 更新位置
        this.x += this.vx * speedFactor;
        this.y += this.vy * speedFactor;

        // 墙壁反弹逻辑
        if (this.x < this.radius || this.x > canvas.width - this.radius) {
            this.vx *= -0.8; // 碰到墙壁反弹，并损失一点速度
            this.x = Math.max(this.radius, Math.min(this.x, canvas.width - this.radius));
        }

        // 掉出屏幕下方
        if (this.y > canvas.height + this.radius) {
            return false;
        }
        return true;
    }

    draw(ctx) {
        // --- 火焰特效 ---
        if (this.isFireball) {
            const time = Date.now() / 100;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; // 叠加发光模式
            
            // 绘制动态火焰拖尾/光环
            for(let i=0; i<3; i++) {
                const r = this.radius + 10 + Math.sin(time + i) * 10;
                ctx.beginPath();
                ctx.arc(this.x, this.y, r, 0, Math.PI*2);
                ctx.fillStyle = `rgba(255, ${100 + i*50}, 0, ${0.4 - i*0.1})`; // 橙红色渐变
                ctx.fill();
            }
            ctx.restore();
        }

        // 画足球：白色球体 + 黑色五边形纹理
        const grad = ctx.createRadialGradient(
            this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.1,
            this.x, this.y, this.radius
        );
        
        // 火球模式下球体变红
        if (this.isFireball) {
            grad.addColorStop(0, '#FFFFA0'); // 亮黄
            grad.addColorStop(0.5, '#FF4500'); // 橙红
            grad.addColorStop(1, '#8B0000'); // 深红
        } else {
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(0.8, '#DDDDDD');
            grad.addColorStop(1, '#999999');
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();

        // 画纹理
        ctx.save();
        ctx.clip(); // 限制纹理只画在球体内部
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, 2 * Math.PI);
        ctx.stroke();

        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5;
            ctx.beginPath();
            ctx.moveTo(
                this.x + Math.cos(angle) * this.radius * 0.5,
                this.y + Math.sin(angle) * this.radius * 0.5
            );
            ctx.lineTo(
                this.x + Math.cos(angle) * this.radius,
                this.y + Math.sin(angle) * this.radius
            );
            ctx.stroke();
        }
        ctx.restore();

        // 画外轮廓
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
