/**
 * 漂浮文字类 (FloatingText)
 * 用于显示得分、连击提示等，文字会慢慢向上漂浮并消失。
 */
export class FloatingText {
    /**
     * 创建一个漂浮文字
     * @param {number} x X 坐标
     * @param {number} y Y 坐标
     * @param {string} text 显示的内容
     * @param {string} color 颜色
     * @param {number} duration 持续时间（秒），-1 表示永久存在
     */
    constructor(x, y, text, color, duration = 1.0) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = duration;
        this.velocityY = -2; // 向上漂浮的速度
        this.isPersistent = (duration === -1); // 是否永久存在
    }

    /**
     * 更新文字状态
     * @returns {boolean} 是否继续显示
     */
    update() {
        if (!this.isPersistent) {
            this.y += this.velocityY; // 向上移动
            this.life -= 0.02; // 透明度递减
            return this.life > 0;
        }
        return true; // 如果是永久的，一直返回 true
    }

    /**
     * 绘制文字
     * @param {CanvasRenderingContext2D} ctx 
     */
    draw(ctx) {
        ctx.save(); // 保存上下文状态，防止污染其他绘制
        ctx.globalAlpha = this.life; // 设置透明度
        ctx.fillStyle = this.color;
        ctx.font = "bold 30px 'Fredoka One', sans-serif";
        ctx.textAlign = "center"; // 居中对齐，修复文字偏离问题
        ctx.textBaseline = "middle"; // 垂直居中
        // 添加文字阴影，让它更清晰
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore(); // 恢复上下文状态
    }
}
