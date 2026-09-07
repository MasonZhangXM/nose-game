/**
 * 连击显示管理器 (ComboDisplay.js)
 * 作用：当玩家连续击中目标时，在屏幕上显示 "Combo x5" 这样的特效。
 * 为什么这样做：把这部分视觉效果逻辑单独拿出来，
 * 避免主程序代码太乱，也方便以后修改连击的动画效果。
 */
export class ComboDisplay {
    constructor() {
        // 获取 HTML 中的连击显示元素
        this.el = document.getElementById('combo-display');
        this.numEl = document.getElementById('combo-num');
    }

    /**
     * 显示连击效果
     * @param {string|number} value 连击次数（如 5）
     * @param {boolean} isFever 是否处于狂热模式（如果是，显示得更酷炫一点）
     */
    show(value, isFever) {
        if (!this.el || !this.numEl) return;
        
        // 显示元素
        this.el.classList.remove('hidden');
        this.numEl.innerText = value;

        // 重置动画：通过先移除再添加 animation 样式，让动画重新播放
        this.el.style.animation = 'none';
        this.el.offsetHeight; // 强制浏览器重绘（这是一个常用的小技巧）
        this.el.style.animation = 'pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        // 根据是否是狂热模式，改变文字颜色和发光效果
        if (isFever) {
            this.el.style.color = '#FFD700'; // 金色
            this.el.style.textShadow = '0 0 10px #FF4500'; // 橙红色光晕
        } else {
            this.el.style.color = '#FFF'; // 白色
            this.el.style.textShadow = '2px 2px 0 #000'; // 黑色描边
        }
    }

    /**
     * 隐藏连击显示
     */
    hide() {
        if (!this.el) return;
        this.el.classList.add('hidden');
    }
}
