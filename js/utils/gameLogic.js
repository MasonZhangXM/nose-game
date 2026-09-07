// 假设 literacyData 是全局变量（由 literacy_data.js 加载）
// 在真实的模块化开发中，literacyData 最好也是一个 export 的模块，
// 但为了兼容旧的数据文件，这里直接访问全局变量。

// 内部状态：防止重复抽词的队列
let _charQueue = [];
let _lastFilterKey = "";

// Fisher-Yates 洗牌算法
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

let recentChars = []; // 防重历史记录

/**
 * 随机获取一个识字题目
 * @returns {object} 包含 {汉字, 拼音, 组词} 的对象
 */
export function getRandomLiteracyChar() {
    // 安全检查：如果数据没加载，返回问号
    if (typeof literacyData === 'undefined' || literacyData.length === 0) {
        return { 汉字: "?", 拼音: "", 组词: "" };
    }

    // 获取当前选中的课程范围
    const category = document.getElementById('course-category').value;
    const sub = document.getElementById('course-sub').value;
    const currentKey = `${category}_${sub}`;

    // 如果筛选条件变了，或者队列空了，重新填充
    if (currentKey !== _lastFilterKey || _charQueue.length === 0) {
        let filteredEpisodes = literacyData;

        // 根据选择筛选数据
        if (category === 'kindergarten') {
            if (sub !== 'all') {
                const [start, end] = sub.split('-').map(Number);
                // 筛选集数在范围内的课程
                filteredEpisodes = literacyData.filter(ep => ep.集数 >= start && ep.集数 <= end);
            }
        } else {
            // 小学和英语使用明确的 ID (如 'p1', 'e1')
            filteredEpisodes = literacyData.filter(ep => ep.集数 == sub);
        }

        // 如果筛选结果为空（比如出错了），就用所有数据兜底
        if (filteredEpisodes.length === 0) filteredEpisodes = literacyData;

        let charData;
        let attempts = 0;
        // 尝试最多 10 次寻找不重复的字
        do {
            // 1. 随机选一集
            const episode = filteredEpisodes[Math.floor(Math.random() * filteredEpisodes.length)];
            // 2. 从这一集里随机选一个字
            charData = episode.汉字列表[Math.floor(Math.random() * episode.汉字列表.length)];
            attempts++;
        } while (recentChars.includes(charData.汉字) && attempts < 10);

        // 更新防重队列
        recentChars.push(charData.汉字);
        if (recentChars.length > 6) recentChars.shift();

        return charData;
    }
}

/**
 * 更新子分类下拉菜单
 * @param {string} category - 大分类 (kindergarten/primary/english)
 */
export function updateSubCategories(category) {
    const sub = document.getElementById('course-sub');
    if (!sub) return;

    sub.innerHTML = ''; // 清空现有选项
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    
    // 根据不同分类填充不同的子选项
    if (category === 'kindergarten') {
        defaultOption.text = '全部课程';
        sub.appendChild(defaultOption);
        
        // 幼儿园每50集一个阶段
        const ranges = [
            {val: '1-50', text: '第1-50集 (基础)'},
            {val: '51-100', text: '第51-100集 (进阶)'},
            {val: '101-150', text: '第101-150集 (高级)'},
            {val: '151-200', text: '第151-200集 (拓展)'},
            {val: '201-1200', text: '第201集以后'}
        ];
        
        ranges.forEach(range => {
            const opt = document.createElement('option');
            opt.value = range.val;
            opt.text = range.text;
            sub.appendChild(opt);
        });
    } else if (category === 'primary') {
        defaultOption.text = '请选择年级';
        // ... 其他逻辑保持不变 ...
    }
}

/**
 * 查找同音字
 * @param {string} targetPinyin - 目标拼音 (如 "kè")
 * @returns {string[]} 同音字数组
 */
export function findHomophones(targetPinyin) {
    if (!targetPinyin || typeof literacyData === 'undefined') return [];
    
    // 简单的去声调处理 (kè -> ke)
    const normalize = (py) => py.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const targetBase = normalize(targetPinyin);
    
    const homophones = new Set();
    
    literacyData.forEach(episode => {
        if (!episode.汉字列表) return;
        episode.汉字列表.forEach(item => {
            if (item.拼音 && normalize(item.拼音) === targetBase) {
                homophones.add(item.汉字);
            }
        });
    });
    
    return Array.from(homophones);
}
