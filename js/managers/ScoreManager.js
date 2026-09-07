import { gameState } from '../core/gameState.js';

/**
 * 分数管理器 (ScoreManager.js)
 * 作用：负责分数的增删改查，并更新界面上的分数显示。
 * 为什么这样做：将分数的逻辑封装起来，主程序只需要调用 add(10) 即可，
 * 不用关心具体是加给谁（P1还是P2），也不用关心怎么更新 HTML。
 */
export class ScoreManager {
    /**
     * @param {object} opts 配置对象
     * @param {HTMLElement} opts.scoreEl 玩家1的分数显示元素
     * @param {HTMLElement} opts.scoreP2El 玩家2的分数显示元素（双人模式用）
     */
    constructor({ scoreEl, scoreP2El }) {
        this.scoreEl = scoreEl;
        this.scoreP2El = scoreP2El;
    }

    /**
     * 获取某个玩家当前分数。
     * @param {number} player 玩家编号 (1 或 2)
     * @returns {number} 当前分数
     */
    get(player = 1) {
        if (gameState.playerCount === 2) {
            return player === 1 ? gameState.player1Score : gameState.player2Score;
        }
        return gameState.score;
    }

    /**
     * 直接设置某个玩家的分数（例如重置为0）。
     * @param {number} player 玩家编号
     * @param {number} value 目标分数
     */
    set(player = 1, value = 0) {
        if (gameState.playerCount === 2) {
            if (player === 1) {
                gameState.player1Score = value;
                if (this.scoreEl) this.scoreEl.innerText = gameState.player1Score;
            } else {
                gameState.player2Score = value;
                if (this.scoreP2El) this.scoreP2El.innerText = gameState.player2Score;
            }
            return;
        }
        // 单人模式
        gameState.score = value;
        if (this.scoreEl) this.scoreEl.innerText = gameState.score;
    }

    /**
     * 给某个玩家加分或减分。
     * @param {number} player 玩家编号
     * @param {number} delta 变化量（正数加分，负数减分）
     */
    add(player = 1, delta = 0) {
        const next = this.get(player) + delta;
        // 可以在这里添加防止分数小于0的逻辑
        // if (next < 0) next = 0; 
        this.set(player, next);
    }
}
