/**
 * 粒子类 (Particle)
 * 用于泡泡破裂时的爆炸效果。
 */
export class Particle {
    /**
     * 创建一个粒子
     * @param {number} x 起始 X 坐标
     * @param {number} y 起始 Y 坐标
     * @param {string} color 颜色
     */
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 4 + 2; // 随机大小
        // 随机向四面八方飞散的速度
        this.speedX = (Math.random() - 0.5) * 12;
        this.speedY = (Math.random() - 0.5) * 12;
        this.life = 1.0; // 生命值
        this.gravity = 0.2; // 重力
    }

    /**
     * 更新粒子状态
     * @returns {boolean} 是否存活
     */
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity; // 受重力影响下落
        this.life -= 0.03; // 慢慢消失
        this.radius *= 0.95; // 慢慢变小
        return this.life > 0;
    }

    /**
     * 绘制粒子
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        ctx.save(); // 保存状态，避免影响其他绘制
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        
        // 添加发光效果
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore(); // 恢复状态
    }
}
