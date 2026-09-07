import { WobbleBubbleTarget } from './BubbleTargets.js';
import { gameState } from '../core/gameState.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 切水果模式的目标 (SliceTarget)
 * 可能是水果（西瓜、苹果等）或者炸弹。
 * 继承自 WobbleBubbleTarget 是因为它也是抛物线运动，虽然它是被“抛”上去的。
 */
export class SliceTarget extends WobbleBubbleTarget {
    constructor() {
        super();
        this.initSlice();
    }

    initSlice() {
        const canvas = getCanvas();
        this.radius = 70; // 水果比较大
        this.x = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
        this.y = canvas.height + this.radius; // 从下方抛出

        // 随机抛射速度
        this.vx = (Math.random() - 0.5) * 6 * gameState.speedMultiplier;
        this.vy = -(12 + Math.random() * 6) * gameState.speedMultiplier; // 向上抛
        this.gravity = 0.3 * gameState.speedMultiplier; // 受重力影响

        // 旋转效果
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;

        const rand = Math.random();
        if (rand > 0.85) {
            // 15% 几率是炸弹
            this.type = 'bomb';
            this.color = '#000';
            this.icon = '💣';
        } else {
            // 85% 几率是水果
            this.type = 'fruit';
            const fruits = [
                { icon: '🍉', color: '#FF5555' },
                { icon: '🍎', color: '#FF0000' },
                { icon: '🍌', color: '#FFFF00' },
                { icon: '🍍', color: '#FFA500' },
                { icon: '🥥', color: '#FFFFFF' }
            ];
            const fruit = fruits[Math.floor(Math.random() * fruits.length)];
            this.icon = fruit.icon;
            this.color = fruit.color;
        }
    }
    
    // 覆盖 update 方法以添加重力和旋转
    update() {
         this.vy += this.gravity; // 重力下落
         this.x += this.vx;
         this.y += this.vy;
         this.rotation += this.rotationSpeed; // 旋转

         const canvas = getCanvas();
         // 掉出屏幕下方销毁
         if (this.y > canvas.height + this.radius + 100) {
             return false;
         }
         return true;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation); // 应用旋转
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;
        ctx.font = "80px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.icon, 0, 0); // 直接画 Emoji
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}
