import { BaseTarget } from './BaseTarget.js';
import { gameState } from '../core/gameState.js';
import { drawBubbleBody, drawBubbleIcon, drawWordOverlay } from '../utils/drawing.js';
import { getRandomLiteracyChar } from '../utils/gameLogic.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 摇摆泡泡基类 (WobbleBubbleTarget)
 * 这是一个会飘来飘去、带摇摆动画的泡泡。
 * 它是 Pop 模式和 Literacy 模式中泡泡的父类。
 */
export class WobbleBubbleTarget extends BaseTarget {
    constructor(opts) {
        super(opts);
        this.vx = 0; // 水平速度
        this.vy = 0; // 垂直速度
        this.wobbleAxis = 'x'; // 摇摆方向（x轴摇摆还是y轴摇摆）
        this.type = 'normal'; // 类型：normal, bomb, gold 等
        this.hue = Math.random() * 360; // 随机颜色色相
        this.color = `hsl(${this.hue}, 80%, 60%)`; // 计算出的颜色
    }

    /**
     * 更新泡泡位置
     * @returns {boolean} 如果跑出屏幕太远返回 false，否则返回 true
     */
    update() {
        const speedFactor = this.getSpeedFactor();
        const canvas = getCanvas();

        // 1. 如果被冰冻了，泡泡几乎静止，只微微颤抖
        if (gameState.isFrozen) {
            this.x += Math.sin(Date.now() / 50) * 1.0;
            return true;
        }

        // 2. 如果磁铁道具生效，并且检测到了鼻子位置，就向鼻子飞去
        if (gameState.isMagnetActive && gameState.nosePos && gameState.nosePos.x) {
            const dx = gameState.nosePos.x - this.x;
            const dy = gameState.nosePos.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // 在一定范围内才吸附
            if (dist < 400 && dist > 10) {
                this.vx += (dx / dist) * 1.5;
                this.vy += (dy / dist) * 1.5;

                // 限制最大飞行速度
                const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                const maxSpeed = 15;
                if (currentSpeed > maxSpeed) {
                    this.vx = (this.vx / currentSpeed) * maxSpeed;
                    this.vy = (this.vy / currentSpeed) * maxSpeed;
                }
            }
        }

        // 3. 正常移动
        this.x += this.vx * speedFactor;
        this.y += this.vy * speedFactor;

        // 4. 叠加正弦波摇摆效果，看起来更像飘浮的泡泡
        if (this.wobbleAxis === 'x') {
            this.x += Math.sin((Date.now() / 400) + this.wobbleOffset) * 1.5;
        } else {
            this.y += Math.sin((Date.now() / 400) + this.wobbleOffset) * 1.5;
        }

        // 5. 检查是否飞出屏幕（加上 100 像素的缓冲区）
        if (
            this.x < -this.radius - 100 ||
            this.x > canvas.width + this.radius + 100 ||
            this.y < -this.radius - 100 ||
            this.y > canvas.height + this.radius + 100
        ) {
            return false; // 飞远了，销毁它
        }
        return true;
    }
    
    // 默认绘制方法，子类可以覆盖，或者直接复用 drawing.js 里的
    draw(ctx) {
         // 这里 PopBubbleTarget 和 LiteracyBubbleTarget 的绘制逻辑稍有不同
         // 为了简单，我们让子类去调用 drawing.js
    }
}

/**
 * 经典模式的泡泡
 * 可能是普通泡泡、炸弹、核弹、冰冻、磁铁、金币等。
 */
export class PopBubbleTarget extends WobbleBubbleTarget {
    constructor() {
        super();
        this.initPop();
    }

    /**
     * 初始化泡泡属性（从哪个方向飞入、是什么类型）
     */
    initPop() {
        const canvas = getCanvas();
        this.radius = 40 + Math.random() * 20; // 随机大小

        // 随机从屏幕四边飞入
        const side = Math.floor(Math.random() * 4);
        const speed = (2 + Math.random() * 4) * gameState.speedMultiplier;

        if (side === 0) { // 从下往上
            this.x = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
            this.y = canvas.height + this.radius;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = -speed;
            this.wobbleAxis = 'x';
        } else if (side === 1) { // 从上往下
            this.x = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
            this.y = -this.radius;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = speed;
            this.wobbleAxis = 'x';
        } else if (side === 2) { // 从左往右
            this.x = -this.radius;
            this.y = Math.random() * (canvas.height * 0.8) + (canvas.height * 0.1);
            this.vx = speed;
            this.vy = (Math.random() - 0.5) * 2;
            this.wobbleAxis = 'y';
        } else { // 从右往左
            this.x = canvas.width + this.radius;
            this.y = Math.random() * (canvas.height * 0.8) + (canvas.height * 0.1);
            this.vx = -speed;
            this.vy = (Math.random() - 0.5) * 2;
            this.wobbleAxis = 'y';
        }

        // 随机决定泡泡类型
        const rand = Math.random();
        if (rand > 0.95) this.type = 'bomb';    // 5% 几率炸弹
        else if (rand > 0.93) this.type = 'gold'; // 2% 几率金币
        else if (rand > 0.92) this.type = 'nuke'; // 1% 几率核弹
        else if (rand > 0.91) this.type = 'freeze'; // 1% 几率冰冻
        else if (rand > 0.90) this.type = 'magnet'; // 1% 几率磁铁
        else this.type = 'normal'; // 90% 几率普通泡泡
    }

    draw(ctx) {
        const shouldContinue = drawBubbleBody(ctx, this);
        if (shouldContinue) {
            drawBubbleIcon(ctx, this);
        }
    }
}

/**
 * 识字模式的泡泡
 * 带有汉字、拼音、组词信息。
 */
export class LiteracyBubbleTarget extends WobbleBubbleTarget {
    constructor() {
        super();
        this.initLiteracy();
    }

    initLiteracy() {
        const canvas = getCanvas();
        // 识字泡泡统一从下方升起，方便阅读
        this.radius = 55;
        this.x = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
        this.y = canvas.height + this.radius;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = -(2 + Math.random() * 2) * gameState.speedMultiplier;
        
        // 随机获取一个汉字数据
        const charData = getRandomLiteracyChar();
        this.char = charData.汉字;
        this.pinyin = charData.拼音;
        this.word = charData.组词;

        this.type = 'literacy';
        
        // 10% 几率是金色高分泡泡
        if (Math.random() > 0.9) {
            this.subType = 'gold';
            this.color = '#FFD700';
        }
    }

    draw(ctx) {
        // 先画泡泡体
        drawBubbleBody(ctx, this);
        // 再画上面的文字
        drawWordOverlay(ctx, this);
    }
}
