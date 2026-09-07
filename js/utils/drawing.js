/**
 * 绘图工具文件
 * 这里主要存放一些通用的绘图函数，比如画泡泡、画特效等。
 * 这样做的好处是：任何模式想画泡泡，直接调用这个函数就行，不用重复写代码。
 */

/**
 * 画一个“泡泡外壳”（透明+高光+边缘光），用于多个模式复用。
 * 这个函数只负责画通用的泡泡样子，如果是特殊道具（如金币），会有额外的画法。
 * 
 * @param {CanvasRenderingContext2D} ctx Canvas 画笔，就像画家的笔
 * @param {object} t 目标对象（需要包含 x, y, radius, type, color, hue 等属性）
 * @returns {boolean} 返回 false 表示该目标已经画完了（如金币），返回 undefined/true 表示还需要继续画后续内容
 */
export function drawBubbleBody(ctx, t) {
    // 1. 先画一个基础的圆形路径
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius, 0, 2 * Math.PI);

    // 2. 如果是金币 (gold)，有特殊的画法（闪闪发光的效果）
    if (t.type === 'gold') {
        const time = Date.now();
        // 让金币像心脏一样跳动 (pulse 效果)
        const pulse = Math.sin(time / 200) * 0.1 + 1;

        ctx.save(); // 保存当前画笔状态
        ctx.translate(t.x, t.y); // 移动画布原点到金币中心
        ctx.rotate(time / 500); // 让金币旋转起来
        ctx.scale(pulse, pulse); // 应用跳动缩放

        // 创建径向渐变，模拟金币的金属质感
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, t.radius);
        grad.addColorStop(0, 'rgba(255, 255, 200, 0.9)'); // 中心亮
        grad.addColorStop(0.5, 'rgba(255, 215, 0, 0.6)'); // 中间金黄
        grad.addColorStop(1, 'rgba(255, 165, 0, 0.1)');   // 边缘淡橙
        ctx.fillStyle = grad;
        
        // 画圆并填充
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.fill();

        // 画金币中间的五角星图案
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            // 计算五角星顶点坐标
            ctx.lineTo(
                Math.cos((18 + i * 72) * Math.PI / 180) * t.radius * 0.6,
                -Math.sin((18 + i * 72) * Math.PI / 180) * t.radius * 0.6
            );
            ctx.lineTo(
                Math.cos((54 + i * 72) * Math.PI / 180) * t.radius * 0.3,
                -Math.sin((54 + i * 72) * Math.PI / 180) * t.radius * 0.3
            );
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore(); // 恢复画笔状态

        // 添加金色的发光效果
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 25;
        return false; // 金币画完了，不需要后续通用绘制
    }

    // 3. 针对不同类型的道具，设置不同的填充色和阴影
    if (t.type === 'bomb') { // 炸弹：红色
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 15;
    } else if (t.type === 'nuke') { // 核弹：黑色+呼吸灯效果
        const pulse = 1 + Math.sin(Date.now() / 100) * 0.2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowColor = '#FF4500';
        ctx.shadowBlur = 20 * pulse;
    } else if (t.type === 'freeze') { // 冰冻：青色
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 15;
    } else if (t.type === 'magnet') { // 磁铁：紫色
        ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.shadowColor = '#FF00FF';
        ctx.shadowBlur = 15;
    } else if (t.type === 'shield') { // 护盾：淡青色
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 15;
    } else if (t.type === 'quiz') { // 问答题：根据色相动态变化
        ctx.fillStyle = `hsla(${t.hue}, 100%, 95%, 0.9)`;
        ctx.shadowColor = `hsla(${t.hue}, 100%, 50%, 0.5)`;
        ctx.shadowBlur = 15;
    } else { // 普通泡泡：根据色相淡淡的颜色
        ctx.fillStyle = `hsla(${t.hue}, 80%, 60%, 0.15)`;
        ctx.shadowBlur = 0;
    }
    // 填充底色
    ctx.fill();

    // 4. 绘制泡泡边缘的高光圈（看起来更有立体感）
    const rimGrad = ctx.createRadialGradient(
        t.x, t.y, t.radius * 0.7, // 内圈
        t.x, t.y, t.radius        // 外圈
    );
    // 根据类型设置边缘颜色
    if (t.type === 'bomb') {
        rimGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        rimGrad.addColorStop(1, 'rgba(255, 0, 0, 0.8)');
    } else if (t.type === 'shield') {
        rimGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        rimGrad.addColorStop(1, 'rgba(0, 255, 255, 0.8)');
    } else if (t.type === 'quiz') {
        rimGrad.addColorStop(0, `hsla(${t.hue}, 100%, 80%, 0)`);
        rimGrad.addColorStop(1, `hsla(${t.hue}, 100%, 50%, 1.0)`);
    } else {
        rimGrad.addColorStop(0, `hsla(${t.hue}, 100%, 50%, 0)`);
        rimGrad.addColorStop(1, `hsla(${t.hue}, 100%, 60%, 0.8)`);
    }
    ctx.fillStyle = rimGrad;
    ctx.fill();

    return true; // 告诉调用者，还没画完，可能还需要画图标或文字
}

/**
 * 绘制泡泡上的图标（炸弹、磁铁等）
 * @param {CanvasRenderingContext2D} ctx 
 * @param {object} t 
 */
export function drawBubbleIcon(ctx, t) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (t.type === 'bomb') {
        ctx.font = '40px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText('💣', t.x, t.y);
    } else if (t.type === 'nuke') {
        ctx.font = '40px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText('☢️', t.x, t.y);
    } else if (t.type === 'freeze') {
        ctx.font = '40px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText('❄️', t.x, t.y);
    } else if (t.type === 'magnet') {
        ctx.font = '40px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText('🧲', t.x, t.y);
    } else if (t.type === 'shield') {
        ctx.font = '40px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText('🛡️', t.x, t.y);
    } else if (t.type === 'gold') {
        // 金币已经在 drawBubbleBody 里画过了
    }
}

/**
 * 绘制泡泡上的文字（识字模式、问答模式）
 * @param {CanvasRenderingContext2D} ctx 
 * @param {object} t 
 */
export function drawWordOverlay(ctx, t) {
    if (!t.char) return;

    // 在主画面中，目标是在镜像坐标系下绘制的（translate + scale(-1,1)）
    // 为了让文字看起来是“正向”的，这里临时重置为未镜像的坐标系，并把 X 坐标转换为屏幕坐标
    const canvas = document.getElementsByClassName('output_canvas')[0];
    const drawX = canvas ? (canvas.width - t.x) : t.x; // 取消镜像后的真实屏幕坐标
    const drawY = t.y;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置到未镜像坐标系
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 绘制汉字
    ctx.font = "bold 32px 'Ma Shan Zheng', cursive";
    ctx.fillStyle = "#333";
    ctx.fillText(t.char, drawX, drawY + 5);

    // 绘制拼音（在汉字上方）- 用户反馈不要显示拼音（或者他们认为是英文）
    /*
    if (t.pinyin) {
        ctx.font = "16px 'Varela Round', sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText(t.pinyin, drawX, drawY - 25);
    }
    */
    ctx.restore();
}
