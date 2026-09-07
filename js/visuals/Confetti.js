/**
 * 彩带特效类 (Confetti)
 * 用于在游戏胜利或达到高分时，在屏幕上撒下五颜六色的纸屑。
 */
export class Confetti {
    /**
     * 创建一个彩带粒子
     * @param {number} x 初始 X 坐标
     * @param {number} y 初始 Y 坐标
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // 随机水平速度
        this.vx = (Math.random() - 0.5) * 10;
        // 随机垂直速度（向上喷射，所以是负数）
        this.vy = (Math.random() - 0.5) * 10 - 5; 
        this.gravity = 0.5; // 重力，让彩带慢慢下落
        this.friction = 0.95; // 空气阻力，让速度慢慢减慢
        // 随机颜色
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.rotation = Math.random() * 360; // 初始旋转角度
        this.rotationSpeed = (Math.random() - 0.5) * 10; // 旋转速度
        this.life = 1.0; // 生命值（透明度），从 1.0 开始递减
        this.size = 10 + Math.random() * 10; // 随机大小
    }

    /**
     * 更新彩带状态（每一帧调用）
     * @returns {boolean} 如果彩带还“活着”（生命值 > 0），返回 true；否则返回 false
     */
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity; // 加上重力影响
        this.vx *= this.friction; // 加上阻力影响
        this.rotation += this.rotationSpeed; // 更新旋转角度
        this.life -= 0.015; // 生命值衰减
        return this.life > 0;
    }

    /**
     * 绘制彩带
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180); // 旋转画布
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life; // 设置透明度
        // 画一个正方形代表彩带
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
    }
}
