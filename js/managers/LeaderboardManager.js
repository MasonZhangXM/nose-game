import { MAX_LEADERBOARD_ENTRIES } from '../core/constants.js';

/**
 * 排行榜管理器 (LeaderboardManager.js)
 * 作用：负责保存、读取和显示高分榜。
 * 原理：利用浏览器的 localStorage 功能，把数据保存在用户的电脑里，
 * 这样关闭浏览器后再打开，记录还在。
 */
export class LeaderboardManager {
    constructor() {
        // 从本地存储读取数据，如果没有就创建一个空数组
        this.leaderboard = JSON.parse(localStorage.getItem('noseGame_leaderboard')) || [];
        this.timer = null;
    }

    // 保存当前数据到本地存储
    save() {
        localStorage.setItem('noseGame_leaderboard', JSON.stringify(this.leaderboard));
    }

    // 更新排行榜界面的 HTML 内容
    updateUI() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;
        list.innerHTML = ''; // 先清空列表
        
        if (this.leaderboard.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#888;">暂无记录</div>';
            return;
        }

        // 排序（分数高的在前），截取前几名，然后生成 HTML
        this.leaderboard
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_LEADERBOARD_ENTRIES)
            .forEach((entry, index) => {
                const div = document.createElement('div');
                // 设置简单的样式
                div.style.cssText = 'display:flex; justify-content:space-between; margin: 10px 0; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;';
                div.innerHTML = `
                    <span>#${index + 1} ${entry.name}</span>
                    <span style="color:#FFD700">${entry.score}分</span>
                `;
                list.appendChild(div);
            });
    }

    /**
     * 显示排行榜弹窗
     * @param {Function} callback 当点击关闭或倒计时结束时要执行的函数（比如开始游戏）
     */
    show(callback) {
        const modal = document.getElementById('leaderboard-modal');
        this.updateUI(); // 刷新数据
        modal.classList.remove('hidden');
        
        const btn = document.getElementById('close-leaderboard-btn');
        
        // 清除旧的定时器，防止冲突
        if (this.timer) clearInterval(this.timer);

        if (callback) {
            // 如果有回调函数（说明是游戏开始前展示），显示倒计时
            let timeLeft = 5;
            btn.innerText = `开始游戏 (${timeLeft}s)`;
            
            this.timer = setInterval(() => {
                timeLeft--;
                btn.innerText = `开始游戏 (${timeLeft}s)`;
                if (timeLeft <= 0) {
                    this.close(callback); // 倒计时结束，自动关闭
                }
            }, 1000);
        } else {
            // 如果没有回调函数（说明只是查看），显示“关闭”
            btn.innerText = "关闭";
        }
        
        // 点击按钮也可以手动关闭
        btn.onclick = () => this.close(callback);
    }

    // 关闭排行榜
    close(callback) {
        if (this.timer) clearInterval(this.timer);
        document.getElementById('leaderboard-modal').classList.add('hidden');
        if (callback) callback(); // 执行后续操作（如开始游戏）
    }

    /**
     * 检查分数是否足够上榜
     * @param {number} finalScore 玩家最终得分
     */
    checkHighScore(finalScore) {
        // 如果榜单没满，肯定能上榜
        if (this.leaderboard.length < MAX_LEADERBOARD_ENTRIES) return true;
        // 否则，必须比最后一名分高
        return finalScore > this.leaderboard[this.leaderboard.length - 1].score;
    }

    /**
     * 提交新纪录
     * @param {string} name 玩家名字
     * @param {number} score 分数
     */
    submitHighScore(name, score) {
        this.leaderboard.push({ name: name, score: score, date: Date.now() });
        // 重新排序
        this.leaderboard.sort((a, b) => b.score - a.score);
        // 如果超过最大数量，移除最后一名
        if (this.leaderboard.length > MAX_LEADERBOARD_ENTRIES) this.leaderboard.pop();
        this.save();
    }
}
