import { BGM_TRACKS } from '../core/constants.js';
import { gameState } from '../core/gameState.js';

// 音频上下文：这是浏览器处理声音的核心对象
// 就像画布(Canvas)用于画画，AudioContext 用于发声
const AudioContext = window.AudioContext || window.webkitAudioContext;
export const audioCtx = new AudioContext();

let bgmGainNode = null; // 用于控制背景音乐的音量
export let isBgmPlaying = false;
let bgmInterval = null; // 定时器，用于播放背景音乐的下一个音符
export let currentTrackIndex = 0; // 当前播放哪首歌

// 语音合成(TTS)设置
let ttsVoice = null;
let ttsRate = 1.0;
let audioUnlocked = false;

// 全局变量保存当前的 utterance，防止被垃圾回收
let currentUtterance = null;

/**
 * 初始化语音合成系统
 * 作用：加载浏览器支持的语音列表，并填充到下拉菜单中。
 */
export function initTTS() {
    const voiceSelect = document.getElementById('tts-voice');
    if (!voiceSelect) return;

    // 尝试重置语音系统
    try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
        }
    } catch(e) {}

    function populateVoices() {
        const voices = window.speechSynthesis.getVoices();
        // 调试输出
        console.log("TTS Voices Loaded:", voices.length);
        
        voiceSelect.innerHTML = '<option value="">默认语音</option>';
        let firstChineseVoiceIndex = -1;

        voices.forEach((voice, index) => {
            // 只显示中文语音，避免列表太长
            if (voice.lang.includes('zh') || voice.lang.includes('CN')) {
                const option = document.createElement('option');
                option.textContent = `${voice.name} (${voice.lang})`;
                option.value = index;
                voiceSelect.appendChild(option);

                if (firstChineseVoiceIndex === -1) {
                    firstChineseVoiceIndex = index;
                }
            }
        });

        // 智能优化：如果找到了中文语音，自动选中第一个
        // 这样避免默认语音是英文导致读不出中文的问题
        if (firstChineseVoiceIndex !== -1) {
            voiceSelect.value = firstChineseVoiceIndex;
            console.log("已自动选中中文语音:", voices[firstChineseVoiceIndex].name);
        }
    }

    populateVoices();
    // 有些浏览器加载语音需要一点时间，所以监听这个事件
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoices;
    }
}

/**
 * 初始化背景音乐选择器
 */
export function initBGMSelector() {
    const select = document.getElementById('bgm-select');
    if (!select) return;
    
    select.innerHTML = '';
    BGM_TRACKS.forEach((track, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${track.name}`;
        select.appendChild(option);
    });
    
    // 当用户切换音乐时，如果正在播放，就切歌
    select.addEventListener('change', (e) => {
        currentTrackIndex = parseInt(e.target.value);
        if (isBgmPlaying) {
            startBGM(); // 重新开始播放新歌
        }
    });
}

// 停止背景音乐
export function stopBGM() {
    isBgmPlaying = false;
    if (bgmInterval) clearTimeout(bgmInterval);
    if (bgmGainNode) {
        try {
            bgmGainNode.disconnect();
        } catch(e) {}
    }
}

// 切换背景音乐开关
export function toggleBGM(enabled) {
    if (enabled) {
        startBGM();
    } else {
        stopBGM();
    }
}

/**
 * 解锁音频播放（满足浏览器用户交互策略）
 * 作用：在用户首次点击或触碰后，恢复 AudioContext 和语音合成。
 * 返回：true 表示本次调用成功触发了解锁或已解锁；false 表示未能解锁。
 */
export function unlockAudio() {
    if (audioUnlocked) return true;
    let ok = true;
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) { ok = false; }
    try {
        window.speechSynthesis.resume();
    } catch (e) { /* 某些浏览器可能不支持 resume */ }
    audioUnlocked = ok;
    return ok;
}

/**
 * 试听语音
 */
export function testTTS() {
    console.log("开始试听...");
    speakText("小朋友，你好！欢迎来到听音选字游戏。", () => {
        console.log("试听结束");
    });
}

/**
 * 朗读文本
 * @param {string} text 要朗读的内容
 * @param {Function} callback 朗读完后的回调函数
 * @param {number} speed 语速 (1.0是正常)
 * @param {boolean} isRetry 是否是重试调用（内部使用）
 */
export function speakText(text, callback = null, speed = 1.0, isRetry = false) {
    if ('speechSynthesis' in window) {
        // 先停止之前的朗读，防止重叠
        // 注意：在某些浏览器中，cancel() 是异步的，可能需要一点延迟
        try {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume(); 
            }
            // 如果不是重试，或者重试时确实需要打断，则 cancel
            // 但为了保险，每次都 cancel
            window.speechSynthesis.cancel();
        } catch(e) {}

        // 增加延迟到 100ms (原 50ms)，给予浏览器更多喘息时间
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            currentUtterance = utterance; // 存入全局变量防止回收
            
            utterance.lang = 'zh-CN';
            
            // 读取设置
            const rateInput = document.getElementById('tts-rate');
            const voiceInput = document.getElementById('tts-voice');
            
            // 优先使用传入的 speed，如果没传(1.0)则尝试使用 UI 设置
            let finalRate = speed;
            if (speed === 1.0 && rateInput) {
                 finalRate = parseFloat(rateInput.value);
            }
            utterance.rate = finalRate;
            utterance.volume = 1.0;
            
            // 只有在非重试，或者重试时也想尝试指定语音的情况下才设置 voice
            // 如果是重试模式(isRetry=true)，说明上次可能失败了，这次我们尝试用回默认语音(不设置 voice)
            // 除非用户强制手动选了(这里逻辑简化：重试时降级为默认语音)
            if (!isRetry && voiceInput && voiceInput.value !== "") {
                const voices = window.speechSynthesis.getVoices();
                if (voices[voiceInput.value]) {
                    utterance.voice = voices[voiceInput.value];
                }
            } else if (isRetry) {
                console.log("重试模式：尝试自动选择中文语音");
                const voices = window.speechSynthesis.getVoices();
                // 尝试找到一个中文语音 (zh-CN, zh-TW, etc., 优先 zh-CN)
                let targetVoice = voices.find(v => v.lang === 'zh-CN');
                if (!targetVoice) {
                    targetVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('CN'));
                }
                
                if (targetVoice) {
                    utterance.voice = targetVoice;
                    console.log("重试已切换至:", targetVoice.name);
                } else {
                    console.log("未找到中文语音，使用系统默认");
                }
            }

            // 安全回调机制：确保 callback 一定会被执行，即使语音出错了
            let callbackCalled = false;
            let isWatchdogTriggered = false;
            // 声明在 safeCallback 之前，避免 TDZ (虽然这里执行顺序保证了不会，但为了代码清晰)
            let startWatchdog = null;

            const safeCallback = () => {
                if (startWatchdog) clearTimeout(startWatchdog);
                if (!callbackCalled) {
                    callbackCalled = true;
                    if (callback) callback();
                }
            };
            
            // 启动看门狗：如果 500ms 内没有开始播放，尝试重试一次
            if (!isRetry) {
                 startWatchdog = setTimeout(() => {
                     if (callbackCalled) return;
                     isWatchdogTriggered = true;
                     console.warn("TTS 启动超时，尝试重置并重试...");
                     window.speechSynthesis.cancel();
                     // 稍微歇一下再重试
                     setTimeout(() => speakText(text, callback, speed, true), 100);
                 }, 500);
            }

            const startTime = Date.now();
            utterance.onstart = () => {
                if (startWatchdog) clearTimeout(startWatchdog);
                // console.log("TTS Started");
            };

            // 无论是否有 callback，都应该绑定 onend/onerror 来清理 currentUtterance (可选)
            // 但这里主要为了 safeCallback
            utterance.onend = () => {
                // 如果是 Watchdog 触发的重试，这里就不要再处理了，防止双重重试
                if (isWatchdogTriggered) return;

                // 如果已经结束，先清除看门狗，防止它误判为超时
                if (startWatchdog) clearTimeout(startWatchdog);

                // 秒退检测：如果播放时间太短（<200ms），且文本很长，说明可能根本没读出来
                const duration = Date.now() - startTime;
                if (duration < 200 && text.length > 5 && !isRetry) {
                    console.warn(`TTS 播放异常（耗时 ${duration}ms），尝试切换语音或重试`);
                    // 尝试重试一次
                    setTimeout(() => speakText(text, callback, speed, true), 100);
                    return;
                }
                safeCallback();
            };
            utterance.onerror = (e) => {
                if (isWatchdogTriggered) return;
                if (startWatchdog) clearTimeout(startWatchdog);
                // 忽略 'canceled' 和 'interrupted' 错误
                if (e.error === 'canceled' || e.error === 'interrupted') {
                    return;
                }
                console.error('Speech Error:', e);
                safeCallback();
            };
            
            if (callback) {
                // 兜底超时
                setTimeout(() => {
                    if (!callbackCalled) {
                        // console.warn("语音朗读超时，强制执行回调");
                        safeCallback();
                    }
                }, 4000);
            }
            
            window.speechSynthesis.speak(utterance);
        }, 100);
    } else {
        // 浏览器不支持语音，直接回调
        console.warn("浏览器不支持 speechSynthesis");
        if (callback) callback();
    }
}

/**
 * 播放简单的音效
 * @param {number} freq 频率（音调高低）
 * @param {string} type 波形类型（sine, square, triangle 等，决定音色）
 */
export function playSound(freq, type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator(); // 振荡器（发声源）
    const gain = audioCtx.createGain(); // 增益节点（控制音量）
    osc.type = type || 'sine';
    
    // 如果没有指定频率，随机播放一个音（用于普通击中效果）
    if (!freq) {
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
        freq = notes[Math.floor(Math.random() * notes.length)];
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        // 音调快速升高，模拟“哔”的一声
        osc.frequency.exponentialRampToValueAtTime(freq * 2, audioCtx.currentTime + 0.1);
        
        // 音量快速衰减
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination); // 连接到扬声器
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        return;
    }

    // 播放指定频率
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
    osc.stop(audioCtx.currentTime + 0.5);
}

/**
 * 开始播放背景音乐 (简单的 8-bit 风格生成音乐)
 * 原理：按照预设的音符数组，一个接一个地播放
 */
export function startBGM() {
    if (isBgmPlaying) stopBGM();
    isBgmPlaying = true;
    
    bgmGainNode = audioCtx.createGain();
    bgmGainNode.gain.value = 0.08; // 背景音乐音量小一点
    bgmGainNode.connect(audioCtx.destination);

    const track = BGM_TRACKS[currentTrackIndex];
    console.log("Playing Track:", track.name);
    
    let noteIndex = 0;

    const playNextNote = () => {
        if (!isBgmPlaying) return;

        // 如果处于 Fever 模式，音乐加速
        const speedFactor = gameState.feverMode ? 1.5 : 1.0;
        const currentTempo = track.tempo / speedFactor;

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        osc.type = 'triangle'; // 三角波，听起来像红白机游戏
        osc.frequency.setValueAtTime(track.notes[noteIndex], audioCtx.currentTime);
        osc.connect(bgmGainNode);
        
        const now = audioCtx.currentTime;
        // 简单的包络：声音立刻响起，然后慢慢变弱
        bgmGainNode.gain.cancelScheduledValues(now);
        bgmGainNode.gain.setValueAtTime(0, now);
        bgmGainNode.gain.linearRampToValueAtTime(0.08, now + 0.05);
        bgmGainNode.gain.exponentialRampToValueAtTime(0.001, now + (currentTempo/1000) * 0.9);

        osc.start(now);
        osc.stop(now + (currentTempo/1000));
        
        // 循环播放音符
        noteIndex = (noteIndex + 1) % track.notes.length;

        // 设置定时器播放下一个音符
        bgmInterval = setTimeout(playNextNote, currentTempo);
    };

    playNextNote();
}
