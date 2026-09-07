export class ThemeManager {
    constructor() {
        this.container = document.querySelector('.game-container');
        this.currentTheme = 'default';
        
        // 主题定义
        this.themes = {
            ocean: {
                name: 'ocean',
                keywords: ['鱼', '虾', '水', '海', '游', '贝', '浪', '船', '洋', '河', '湖', '雨', '冰', '洗', '澡', '喝'],
                className: 'theme-ocean',
                particles: ['🐟', '🫧', '🌊', '🐠', '🦐']
            },
            forest: {
                name: 'forest',
                keywords: ['树', '木', '花', '草', '叶', '林', '森', '鸟', '虫', '果', '瓜', '苗', '竹', '兔', '猫', '狗', '羊', '牛', '马', '鸡'],
                className: 'theme-forest',
                particles: ['🍃', '🌸', '🦋', '🐞', '🍄']
            },
            space: {
                name: 'space',
                keywords: ['星', '月', '日', '天', '宇', '宙', '飞', '云', '阳', '光', '亮', '黑', '白', '空', '气', '风'],
                className: 'theme-space',
                particles: ['⭐', '🚀', '🪐', '☄️', '🛸']
            },
            candy: {
                name: 'candy',
                keywords: ['糖', '甜', '吃', '饭', '饼', '蛋', '奶', '肉', '米', '瓜', '果', '口', '舌', '牙'],
                className: 'theme-candy',
                particles: ['🍬', '🍭', '🧁', '🍩', '🍪']
            },
            default: {
                name: 'default',
                keywords: [],
                className: '', // 默认样式
                particles: ['✨', '🎈', '🎉']
            }
        };
    }

    /**
     * 根据字和词组推断主题
     * @param {string} char - 汉字
     * @param {string} phrase - 组词
     */
    guessTheme(char, phrase) {
        const text = (char + phrase).split('');
        
        // 检查每个字是否在关键词列表中
        for (const key in this.themes) {
            if (key === 'default') continue;
            const theme = this.themes[key];
            if (text.some(t => theme.keywords.includes(t))) {
                return key;
            }
        }
        
        return 'default';
    }

    /**
     * 应用主题
     * @param {string} themeName 
     */
    applyTheme(themeName) {
        if (this.currentTheme === themeName) return;
        
        const theme = this.themes[themeName] || this.themes.default;
        
        // 移除旧主题类
        if (this.currentTheme !== 'default') {
            this.container.classList.remove(this.themes[this.currentTheme].className);
        }
        
        // 添加新主题类
        if (themeName !== 'default') {
            this.container.classList.add(theme.className);
        }
        
        this.currentTheme = themeName;
        console.log(`Theme switched to: ${themeName}`);
        
        // 触发一次特效庆祝主题切换
        this.spawnThemeTransitionParticles(theme);
    }

    spawnThemeTransitionParticles(theme) {
        // 简单生成几个漂浮的 emoji
        const count = 10;
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.innerText = theme.particles[Math.floor(Math.random() * theme.particles.length)];
            el.style.position = 'absolute';
            el.style.left = Math.random() * 100 + 'vw';
            el.style.top = Math.random() * 100 + 'vh';
            el.style.fontSize = Math.random() * 30 + 20 + 'px';
            el.style.pointerEvents = 'none';
            el.style.transition = 'all 2s ease-out';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.5)';
            el.style.zIndex = '1';
            
            this.container.appendChild(el);
            
            // 动画
            requestAnimationFrame(() => {
                el.style.opacity = '0.8';
                el.style.transform = 'scale(1.5) translateY(-50px)';
                setTimeout(() => {
                    el.style.opacity = '0';
                    setTimeout(() => el.remove(), 1000);
                }, 1500);
            });
        }
    }
}
