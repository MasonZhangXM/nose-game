import { gameState } from '../core/gameState.js';
import { Particle } from './Particle.js';
import { Confetti } from './Confetti.js';
import { playSound } from '../utils/audio.js';

/**
 * 粒子系统工具函数
 * 用于方便地生成一组粒子或彩带。
 */

/**
 * 在指定位置生成爆炸粒子效果
 * @param {number} x X 坐标
 * @param {number} y Y 坐标
 * @param {string} color 粒子颜色
 */
export function spawnParticles(x, y, color) {
    // 生成更多粒子，模拟绚丽爆炸
    for (let i = 0; i < 30; i++) {
        // 如果传入颜色，则使用该颜色；否则随机颜色（用于绚丽效果）
        const pColor = color || `hsl(${Math.random() * 360}, 100%, 60%)`;
        gameState.particles.push(new Particle(x, y, pColor));
    }
}

/**
 * 生成全屏庆祝彩带
 * @param {number} amount 彩带数量，默认 50 个
 */
export function spawnConfetti(amount = 50) {
    // 尝试获取画布尺寸，如果获取不到则使用默认值
    const canvas = document.getElementsByClassName('output_canvas')[0];
    const startX = canvas ? canvas.width / 2 : 640;
    const startY = canvas ? canvas.height / 2 : 360;
    
    // 生成指定数量的彩带
    for (let i = 0; i < amount; i++) {
        gameState.confettis.push(new Confetti(startX, startY));
    }
    // 播放庆祝音效
    playSound(1200, 'triangle');
}
