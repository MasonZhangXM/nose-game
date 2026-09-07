import { BaseGameMode } from './BaseGameMode.js';
import { QuizOptionTarget, QuizBombTarget, QuizShieldTarget } from '../targets/QuizTargets.js';
import { gameState } from '../core/gameState.js';
import { playSound, speakText } from '../utils/audio.js';
import { FloatingText } from '../visuals/FloatingText.js';
import { getRandomLiteracyChar, findHomophones } from '../utils/gameLogic.js';
import { spawnConfetti, spawnParticles } from '../visuals/ParticleSystem.js';
import { ThemeManager } from '../managers/ThemeManager.js';
import { VoiceManager } from '../managers/VoiceManager.js';

const getCanvas = () => document.getElementsByClassName('output_canvas')[0];

/**
 * 问答模式 (Quiz Mode)
 * 玩法：系统朗读一个词，屏幕出现 3 个选项，玩家需要选出正确的字。
 * 特点：回合制，考验听力和识字能力。
 */
export class QuizMode extends BaseGameMode {
    constructor(deps) {
        super(deps);
        this.onGameOver = deps.onGameOver;
        this.comboCount = 0;
        this.state = gameState.quizState;
        this.themeManager = new ThemeManager();
        this.voiceManager = new VoiceManager();
    }

    onEnter() {
        gameState.lives = 5; // 5 条命
        console.log("QuizMode entered. Lives reset to 5.");
        this.lastDamageTime = 0; // 伤害冷却
        gameState.hasShield = false; // 初始化护盾
        this.comboCount = 0;
        // 初始化问答状态
        this.state.active = true;
        this.state.phase = 'waiting'; // 初始状态：等待出题
        this.state.nextQuestionTime = Date.now() + 1000;
        this.state.targetChar = null;
        this.state.startTime = Date.now();
        this.state.timeLimit = 300000; // 5 分钟限时
        gameState.quizState = this.state;
        gameState.quizCombo = 0;
        
        // 延时一小会儿开始，给玩家准备时间
        setTimeout(() => {
            if (gameState.gameActive && gameState.gameMode === 'quiz') {
                this.startRound();
            }
        }, 100);
    }

    // Quiz 模式自己控制生成节奏，不需要主循环自动生成
    getSpawnInterval() {
        return null;
    }

    update(now) {
        // 如果处于等待阶段且时间到了，就开始下一轮
        if (this.state.phase === 'waiting' && now > this.state.nextQuestionTime) {
            this.startRound();
        }
    }

    /**
     * 开始新的一轮出题
     */
    startRound() {
        const canvas = getCanvas();
        if (this.state.phase !== 'waiting') {
            return;
        }
        this.state.phase = 'spawning';
        this.mistakeCount = 0; // 重置错误计数

        gameState.targets = gameState.targets.filter(t => t.type === 'bomb');

        // 1. 随机选一个“正确答案”
        const correctData = getRandomLiteracyChar();
        this.state.targetChar = correctData;

        // 2. 随机选两个“干扰项”
        const distractors = [];
        while (distractors.length < 2) {
            const d = getRandomLiteracyChar();
            // 确保干扰项和正确答案不同，且互不相同
            if (d.汉字 !== correctData.汉字 && !distractors.some(x => x.汉字 === d.汉字)) {
                distractors.push(d);
            }
        }

        // 连击越高，语速越快，难度增加 (降低初始速度和增速)
        const voiceSpeed = Math.min(1.8, 0.8 + Math.floor(this.comboCount / 3) * 0.1);
        gameState.floatingTexts = gameState.floatingTexts.filter(ft => !ft.isPersistent);

        const phrase = correctData.组词 || "";
        const targetChar = correctData.汉字 || "";

        // 根据字词应用主题场景
        const theme = this.themeManager.guessTheme(targetChar, phrase);
        this.themeManager.applyTheme(theme);

        let promptText = "";
        if (phrase && phrase.includes(targetChar)) {
             // 例如：请找出筷子的子
             promptText = `请找出${phrase}的${targetChar}`;
        } else {
             promptText = `请找出${targetChar}`;
        }

        let hasGenerated = false;

        // 1. 先进入 active 阶段，让 UI (文字) 显示出来
        this.state.phase = 'active';

        // 2. 延迟 500ms 后再播放语音
        setTimeout(() => {
            // 如果玩家已经退出了或者状态变了，就不读了
            if (this.state.phase !== 'active' || !gameState.gameActive) return;

            speakText(promptText, () => {
                if (hasGenerated) return;
                hasGenerated = true;

                const positions = [
                    (0.1 + Math.random() * 0.2) * canvas.width,
                    (0.4 + Math.random() * 0.2) * canvas.width,
                    (0.7 + Math.random() * 0.2) * canvas.width
                ];
                for (let i = positions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [positions[i], positions[j]] = [positions[j], positions[i]];
                }

                // 生成泡泡
                // 30% 概率生成语音泡泡
                const isVoice = Math.random() < 0.3; 
                console.log(`Spawning bubble. Voice Support: ${this.voiceManager.hasSupport}, isVoice: ${isVoice}`);
                
                gameState.targets.push(new QuizOptionTarget(correctData, true, positions[0], isVoice));
                gameState.targets.push(new QuizOptionTarget(distractors[0], false, positions[1]));
                gameState.targets.push(new QuizOptionTarget(distractors[1], false, positions[2]));

                // 有几率生成陷阱（炸弹）
                const currentBombs = gameState.targets.filter(t => t.type === 'bomb').length;
                // 连击达到 3 次后，开始生成炸弹
                if (this.comboCount >= 3 && currentBombs < 3) {
                     // 连击越高，炸弹越多/概率越大
                     const chance = 0.5 + (this.comboCount - 3) * 0.1;
                     if (Math.random() < chance) {
                         gameState.targets.push(new QuizBombTarget());
                     }
                }

                // 有小几率生成护盾
                if (Math.random() < 0.1) {
                    gameState.targets.push(new QuizShieldTarget());
                }
            }, voiceSpeed);
        }, 500);
    }

    drawHud(ctx) {
        const canvas = getCanvas();
        const now = Date.now();
        const elapsed = now - this.state.startTime;
        const remaining = Math.max(0, this.state.timeLimit - elapsed);
        
        if (remaining <= 0) {
            this.onGameOver();
            return;
        }

        // 绘制时间 (倒计时)
        ctx.save();
        ctx.font = "bold 32px Arial";
        ctx.fillStyle = remaining < 30000 ? "#FF4444" : "#FFFFFF"; // 最后30秒变红
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        ctx.fillText(`⏱️ ${timeText}`, canvas.width / 2, 20);
        ctx.restore();

        // 绘制生命值 (Hearts) - 下移避免遮挡分数板和 Combo
         ctx.save();
         
         ctx.font = "36px Arial"; 
         ctx.textAlign = "left";
         ctx.textBaseline = "middle"; 
         
         const heartX = 35;
         const heartY = 185; // 160 + 50/2 = 185
         
         let hearts = "";
         for (let i = 0; i < gameState.lives; i++) {
             hearts += "❤️";
         }
         
         // 动态计算宽度以避免重叠
         const heartsWidth = ctx.measureText(hearts).width;
         const shieldWidth = gameState.hasShield ? ctx.measureText("🛡️").width : 0;
         const padding = 20;
         const spacing = 10;
         // 基础宽度 240，如果内容多了就自动撑开
         const contentWidth = heartX - 20 + heartsWidth + (gameState.hasShield ? spacing + shieldWidth : 0) + padding;
         const bgWidth = Math.max(240, contentWidth);

         // 背景框
         ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
         ctx.beginPath();
         ctx.roundRect(20, 160, bgWidth, 50, 15); // y从90下移到160
         ctx.fill();

         ctx.fillText(hearts, heartX, heartY);

         // 绘制护盾
         if (gameState.hasShield) {
              // 放在红心后面，紧跟在红心文字宽度的后面
              const shieldX = heartX + heartsWidth + spacing; 
              ctx.fillText("🛡️", shieldX, heartY);
         }
         ctx.restore();

        if (this.state.targetChar && this.state.phase === 'active') {
             ctx.save();
             // 绘制题目背景框（更亮丽的风格）
             ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
             ctx.strokeStyle = "#FFD700";
             ctx.lineWidth = 6;
             ctx.beginPath();
             // 加大背景框尺寸以容纳更大的字体
             ctx.roundRect(canvas.width/2 - 300, 60, 600, 100, 40);
             ctx.fill();
             ctx.stroke();

             // 字体放大：36px -> 55px
             ctx.font = "bold 55px 'Ma Shan Zheng', cursive";
             ctx.textAlign = "left";
             ctx.textBaseline = "middle";

             const phrase = this.state.targetChar.组词 || "";
             const targetChar = this.state.targetChar.汉字 || "";
             const label = "请找出: ";
             const fullText = label + phrase;
             const fullWidth = ctx.measureText(fullText).width;
             const startX = canvas.width / 2 - fullWidth / 2;
             const baseY = 110; // 稍微调整基线

             const index = phrase.indexOf(targetChar);

             if (!phrase || !targetChar || index === -1) {
                 ctx.fillStyle = "#333"; // 深色文字
                 ctx.fillText(fullText, startX, baseY);
             } else {
                 const prefix = phrase.slice(0, index);
                 const middle = targetChar;
                 const suffix = phrase.slice(index + middle.length);

                 const prefixText = label + prefix;
                 const middleText = middle;
                 const prefixWidth = ctx.measureText(prefixText).width;
                 const middleWidth = ctx.measureText(middleText).width;

                 ctx.fillStyle = "#333"; // 深色前缀
                 ctx.fillText(prefixText, startX, baseY);

                 // 绘制拼音 (在目标字上方) - 字体放大 20px -> 28px
                 const pinyin = this.state.targetChar.拼音 || "";
                 if (pinyin) {
                     ctx.save();
                     ctx.font = "bold 28px Arial";
                     ctx.fillStyle = "#FF4500";
                     ctx.textAlign = "center";
                     // 调整拼音垂直位置
                     ctx.fillText(pinyin, startX + prefixWidth + middleWidth / 2, baseY - 45);
                     ctx.restore();
                 }

                 ctx.fillStyle = "#FF4500"; // 亮橙红色高亮
                 ctx.fillText(middleText, startX + prefixWidth, baseY);

                 ctx.fillStyle = "#333"; // 深色后缀
                 ctx.fillText(suffix, startX + prefixWidth + middleWidth, baseY);
             }
             ctx.restore();
        }
    }

    // handleCollision 逻辑比较复杂，为了文件简洁，大部分逻辑保留在 QuizTargets.js 的 hit() 方法里了
    // 这里如果需要也可以把逻辑搬过来，但目前架构是 target 自己处理被击中后的反馈，
    // 然后通过回调或者状态改变通知 mode。
    
    startVoiceUnlock(target) {
        console.log("Starting Voice Unlock...");
        target.isWaitingForVoice = true;
        
        // 暂停游戏倒计时 (通过记录暂停开始时间)
        this.voicePauseStart = Date.now();
        
        // 播放提示音
        speakText("大声读出来！");
        
        // 准备所有有效的答案变体
        const validPatterns = [target.char]; // 基础汉字 (如 "课")
        
        // 1. 增加组词 (如 "上课") - 识别词语通常比单字更准
        if (target.word) {
            validPatterns.push(target.word);
        }
        
        // 2. 增加拼音 (如 "kè" 或 "ke") - 防止识别成拼音或英文
        if (target.pinyin) {
            validPatterns.push(target.pinyin); // 带声调
            // 去声调 (简单处理)
            const cleanPinyin = target.pinyin.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            validPatterns.push(cleanPinyin);

            // 3. 增加同音字 (数据库内查找) - 解决“课”识别成“客”的问题
            const homophones = findHomophones(target.pinyin);
            validPatterns.push(...homophones);
        }

        console.log("Valid voice patterns:", validPatterns);

        // 初始化反馈文本
        target.feedbackText = "正在听...";

        // 开始监听 (给予 3 秒时间，让小朋友有足够反应时间)
        this.voiceManager.listenFor(validPatterns, (success, result) => {
            // 恢复游戏
            const pauseDuration = Date.now() - this.voicePauseStart;
            gameState.lastFrameTime += pauseDuration; // 补偿时间
            
            // 无论成功失败，都解除锁定
            target.isWaitingForVoice = false;
            target.feedbackText = ""; // 清除实时反馈

            if (success) {
                console.log("Voice unlock success!");

                // 区分是精准匹配还是声音检测
                if (result === "[声音检测通过]") {
                    // 备用计划通过 (分低一点，鼓励一下)
                    gameState.score += 5;
                    gameState.floatingTexts.push(new FloatingText(target.x, target.y - 50, "声音很洪亮! +5", "#00FFFF")); // 青色
                    speakText("声音真大！");
                    
                    if (typeof spawnConfetti === 'function') {
                        spawnConfetti(target.x, target.y);
                    }
                } else {
                    // 精准匹配
                    // 触发成功逻辑：2倍分数，大量特效
                    gameState.score += 20; // 额外加分
                    gameState.quizCombo++; // 额外增加连击
                    this.comboCount++;
                    
                    if (result === "模拟通过") {
                        gameState.floatingTexts.push(new FloatingText(target.x, target.y - 50, "设备不支持语音，自动通过", "#FFFF00"));
                    }
                    
                    // 播放超酷音效
                    if (typeof spawnConfetti === 'function') {
                        spawnConfetti(target.x, target.y);
                        spawnConfetti(target.x, target.y); // 双倍快乐
                    }
                }
                
                // 移除泡泡
                target.shouldRemove = true;
                
                // 触发下一题
                this.state.phase = 'waiting';
                this.state.nextQuestionTime = Date.now() + 1000;
                
                // 震动
                if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);

            } else {
                console.log("Voice unlock failed/timeout.");
                
                // 失败或超时
                // 如果是 timeout 并且有识别内容，显示出来
                if (result !== "timeout" && result !== "insecure_context" && result !== "error") {
                    // 说明听到了声音，但是不对
                    gameState.floatingTexts.push(new FloatingText(target.x, target.y - 50, `没听清，听到：${result}`, "#FFA500"));
                } else if (result === "timeout") {
                     gameState.floatingTexts.push(new FloatingText(target.x, target.y - 50, "太久没说话啦", "#FFA500"));
                } else {
                     gameState.floatingTexts.push(new FloatingText(target.x, target.y - 50, "没听清，再试一次", "#FFA500"));
                }
                
                // 失败逻辑：泡泡弹开
                target.vx = (Math.random() - 0.5) * 20; // 强力弹开
                target.vy = -10;
                target.hitProcessed = false; // 允许再次触发
                speakText("再试一次！");
            }
        }, 3000, (interimText) => {
            target.feedbackText = interimText;
        }); // 3秒超时
    }

    /**
     * 提供暗示：高亮正确答案，减少干扰项
     */
    provideHint() {
        console.log("Providing hint...");
        
        try {
            // 1. 高亮正确答案
            gameState.targets.forEach(t => {
                if (t.type === 'quiz' && t.isQuizAnswer) {
                    t.isHinted = true; // 标记为受提示状态
                    // 立即产生一点视觉反馈（比如粒子）
                    if (typeof spawnParticles === 'function') {
                        spawnParticles(t.x, t.y, t.color, 5);
                    }
                }
            });

            // 2. 随机移除一个干扰项 (帮助排除错误)
            // 找出所有非炸弹、非护盾、非正确答案的干扰项
            const distractors = gameState.targets.filter(t => 
                t.type === 'quiz' && !t.isQuizAnswer && !t.shouldRemove
            );
            
            if (distractors.length > 0) {
                // 随机选一个移除
                const toRemove = distractors[Math.floor(Math.random() * distractors.length)];
                // 标记为需要移除，让 update() 在下一帧处理，避免破坏主循环的数组索引
                toRemove.shouldRemove = true;
                // 稍微给点消失特效
                if (typeof spawnParticles === 'function') {
                    spawnParticles(toRemove.x, toRemove.y, "#999", 5);
                }
            } else {
                console.log("No distractors left to remove.");
            }
        } catch (e) {
            console.error("Error in provideHint:", e);
        }
    }

    /**
     * 统一处理伤害逻辑，增加冷却防止瞬间多次扣血
     */
    takeDamage(amount = 1) {
        const now = Date.now();
        // 1秒伤害冷却 (防止比如一次横扫误触多个干扰项导致瞬间暴毙)
        if (now - this.lastDamageTime < 1000) {
            console.log("Damage ignored due to cooldown.");
            return false;
        }
        this.lastDamageTime = now;

        gameState.lives -= amount;
        console.log(`Took damage! Lives remaining: ${gameState.lives}`);
        
        if (gameState.lives <= 0) {
            console.log("Game Over triggered due to lives <= 0");
            this.onGameOver();
        }
        return true;
    }

    handleCollision(t, player = 1) {
        // 防止同一个目标被重复触发（虽然主循环有处理，加一道保险）
        if (t.hitProcessed) return false;

        // --- 语音泡泡拦截逻辑 ---
        if (t.type === 'quiz' && t.isQuizAnswer && t.isVoiceTarget) {
            // 如果已经在等待语音，则不进行任何处理 (保持状态)
            if (t.isWaitingForVoice) return false;

            // 触发语音解锁流程
            t.hitProcessed = true; // 标记已处理，防止下一帧重复触发
            this.startVoiceUnlock(t);
            return false; // 返回 false 告诉主循环不要移除它
        }
        // -----------------------
        
        t.hitProcessed = true;

        // 如果是炸弹，扣命
        if (t.type === 'bomb') {
            playSound(100);
            speakText("哎呀"); // 增加语音反馈
            
            this.comboCount = 0; // 连击清零
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "哎呀！", "#FF0000"));
            
            // 屏幕震动反馈
            const container = document.querySelector('.game-container');
            if(container) {
                container.classList.add('shake');
                container.classList.add('flash-red');
                setTimeout(() => {
                    container.classList.remove('shake');
                    container.classList.remove('flash-red');
                }, 500);
            }

            // 手机强震动
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]); // 震动两下

            // 炸弹爆炸特效
             if (typeof spawnParticles === 'function') {
                spawnParticles(t.x, t.y, "#FF0000"); // 红色爆炸
            }

            this.takeDamage(1);
            return true;
        }

        // 如果是护盾，获得护盾
        if (t.type === 'shield') {
            gameState.hasShield = true;
            playSound(600, 'sine');
            gameState.floatingTexts.push(new FloatingText(t.x, t.y, "护盾！", "#00FFFF")); // 蓝字
            return true;
        }

        // 如果是选项泡泡
        if (t.type === 'quiz') {
            // 1. 无论对错，先播放泡泡上的字/词读音 (增加 100ms 延迟避免声音冲突)
            setTimeout(() => {
                if (t.char) speakText(t.char + (t.word ? "，" + t.word : ""));
            }, 100);

            if (t.isQuizAnswer) {
                // 答对了！
                playSound(800, 'sine');
                
                // 延时播放夸奖，让读音先播完 (已根据用户要求移除“答对了”语音，仅保留UI反馈)
                // setTimeout(() => speakText("答对了"), 1500);
                
                this.comboCount++;
                const points = 20 * (1 + Math.floor(this.comboCount / 3) * 0.5);
                this.scoreManager.add(player, points);
                
                // 特效
                let comboText = "答对了！";
                if (this.comboCount >= 3) {
                    comboText = `连对 ${this.comboCount}!`;
                    playSound(1000, 'square'); // 连击时的特殊音效
                }
                gameState.floatingTexts.push(new FloatingText(t.x, t.y, comboText, "#00FF00")); // 绿字
                
                // 1. 泡泡本体爆炸特效 (爽感来源)
                // 生成大量同色粒子，模拟泡泡炸裂
                if (typeof spawnParticles === 'function') {
                    spawnParticles(t.x, t.y, t.color); 
                }

                // 2. 连击越高，全屏礼花越多
                const confettiCount = 20 + Math.min(this.comboCount * 5, 50);
                spawnConfetti(confettiCount); 
                
                // 进入等待下一题状态
                this.state.phase = 'waiting';
                this.state.nextQuestionTime = Date.now() + 1000;
                
                // 返回特殊标记，告诉主循环清理其他选项
                return 'quiz_correct';
            } else {
                // 答错了...
                if (gameState.hasShield) {
                    gameState.hasShield = false;
                    playSound(400, 'triangle');
                    gameState.floatingTexts.push(new FloatingText(t.x, t.y, "护盾抵消！", "#00FFFF")); // 蓝字
                    return true; // 抵消一次
                }

                playSound(150);
                
                this.comboCount = 0; // 连击清零
                gameState.floatingTexts.push(new FloatingText(t.x, t.y, "再试试！", "#FFA500")); // 橙色温馨提示
                
                // 1. 错误反馈特效：灰色烟雾 + 震动
                if (typeof spawnParticles === 'function') {
                    spawnParticles(t.x, t.y, "#CCCCCC"); // 灰色粒子，表示“不是这个”
                }
                
                // 屏幕震动 (模仿炸弹的震动，但稍微轻一点)
                const container = document.querySelector('.game-container');
                if(container) {
                    container.classList.add('shake');
                    setTimeout(() => {
                        container.classList.remove('shake');
                    }, 300); // 300ms 震动，比炸弹短一点
                }
                // 手机震动
                if (navigator.vibrate) navigator.vibrate(200);

                // 扣血 (如果冷却中则不扣)
                const damageTaken = this.takeDamage(1);
                
                if (gameState.lives > 0) {
                    // 答错了但不换题，给出提示
                    // 延时播放重读题目，让前面的读音先播完
                    setTimeout(() => {
                        speakText("再仔细找找看");
                        // 再播一遍题目，加强记忆
                        if (this.state.targetChar && this.state.targetChar.汉字) {
                            setTimeout(() => {
                                speakText("请找出" + this.state.targetChar.汉字);
                            }, 1500);
                        }
                    }, 1500);
                    
                    this.provideHint();
                }
                
                return true; // 只移除当前错误的泡泡，保留其他泡泡
            }
        }

        return true;
    }
}
