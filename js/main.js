/**
 * Daily Finance Brief - Main Logic (Optimized Version)
 * 功能：自动加载数据、渲染卡片、搜索过滤、Tab切换、暗色模式
 */

// --- 1. 动态注入核心样式 (确保即使CSS未更新也有阴影和动效) ---
const style = document.createElement('style');
style.innerHTML = `
    :root { --primary: #2563eb; --bg: #f8f9fa; --card-bg: #fff; --text: #1a1a2e; --shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    body.dark-mode { --bg: #0f172a; --card-bg: #1e293b; --text: #f1f5f9; --shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; transition: background 0.3s; margin: 0; padding: 20px; }
    
    /* 卡片核心样式 */
    .news-card { 
        background: var(--card-bg); border-radius: 12px; padding: 20px; margin-bottom: 16px; 
        box-shadow: var(--shadow); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; border: 1px solid transparent; 
    }
    .news-card:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-color: var(--primary); }
    
    /* 布局与排版 */
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .search-box { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 20px; font-size: 16px; background: var(--card-bg); color: var(--text); }
    .tabs { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 20px; scrollbar-width: none; }
    .tab-btn { padding: 8px 16px; border-radius: 20px; border: none; background: #e2e8f0; color: #64748b; white-space: nowrap; cursor: pointer; transition: 0.2s; }
    .tab-btn.active { background: var(--primary); color: white; }
    
    /* 内容细节 */
    .card-title { font-size: 18px; font-weight: bold; margin-bottom: 8px; line-height: 1.4; }
    .card-meta { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-top: 12px; align-items: center; }
    .tag { padding: 2px 8px; border-radius: 4px; background: #eff6ff; color: var(--primary); font-weight: 500; }
    .loading { text-align: center; padding: 40px; color: #94a3b8; }
    .error-msg { text-align: center; padding: 20px; color: #ef4444; background: #fef2f2; border-radius: 8px; }
`;
document.head.appendChild(style);

// --- 2. 全局状态与配置 ---
let allNewsData = []; // 存储所有新闻数据
let currentCategory = 'all'; // 当前选中的分类

// 尝试两个可能的数据路径
const DATA_PATHS = ['data/news-data.json', 'news-data.json']; 

// --- 3. 初始化逻辑 ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupSearch();
    loadData(); // 开始加载数据
});

// 初始化主题（读取本地存储）
function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.body.classList.add('dark-mode');
}

// 设置搜索框监听
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterAndRender(e.target.value);
        });
    }
}

// --- 4. 数据加载核心逻辑 ---
async function loadData() {
    const container = document.getElementById('news-container');
    if (!container) return;

    // 显示加载中
    container.innerHTML = '<div class="loading">正在连接全球财经节点...<br>加载中...</div>';

    let dataLoaded = false;

    // 轮询尝试不同的路径
    for (const path of DATA_PATHS) {
        try {
            console.log(`Trying to fetch: ${path}`);
            const response = await fetch(path);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            // 兼容不同的数据结构 (数组 或 { news: [] })
            allNewsData = Array.isArray(data) ? data : (data.news || data.data || []);
            
            if (allNewsData.length > 0) {
                dataLoaded = true;
                console.log(`Success! Loaded ${allNewsData.length} items from ${path}`);
                break; // 成功则跳出循环
            }
        } catch (error) {
            console.warn(`Failed to load from ${path}:`, error);
        }
    }

    if (dataLoaded) {
        renderTabs(); // 渲染分类标签
        filterAndRender(); // 渲染内容
    } else {
        // 最终失败的处理
        container.innerHTML = `
            <div class="error-msg">
                <h3>⚠️ 无法获取数据</h3>
                <p>请检查 GitHub 仓库中是否存在 <code>news-data.json</code> 文件。</p>
                <p>或者文件是否在 <code>data/</code> 文件夹下。</p>
                <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer;">重试</button>
            </div>
        `;
    }
}

// --- 5. 渲染逻辑 ---

// 渲染顶部 Tab 按钮
function renderTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;

    // 提取所有不重复的分类
    const categories = ['all', ...new Set(allNewsData.map(item => item.category).filter(Boolean))];
    
    tabsContainer.innerHTML = categories.map(cat => `
        <button class="tab-btn ${cat === currentCategory ? 'active' : ''}" 
                onclick="switchTab('${cat}')">
            ${getCategoryName(cat)}
        </button>
    `).join('');
}

// 切换 Tab
window.switchTab = function(category) {
    currentCategory = category;
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    // 重新渲染
    filterAndRender(document.getElementById('search-input').value);
}

// 核心渲染函数
function filterAndRender(keyword = '') {
    const container = document.getElementById('news-container');
    if (!container) return;

    // 1. 过滤数据
    let filtered = allNewsData;

    // 按分类过滤
    if (currentCategory !== 'all') {
        filtered = filtered.filter(item => item.category === currentCategory);
    }

    // 按关键词过滤
    if (keyword) {
        const lowerKeyword = keyword.toLowerCase();
        filtered = filtered.filter(item => 
            (item.title && item.title.toLowerCase().includes(lowerKeyword)) ||
            (item.summary && item.summary.toLowerCase().includes(lowerKeyword))
        );
    }

    // 2. 生成 HTML
    if (filtered.length === 0) {
        container.innerHTML = '<div class="loading">没有找到相关资讯 🧐</div>';
        return;
    }

    container.innerHTML = filtered.map(item => `
        <div class="news-card" onclick="window.open('${item.url || '#'}', '_blank')">
            <div class="card-title">${item.title}</div>
            ${item.summary ? `<div style="font-size:14px; color:#64748b; margin-bottom:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${item.summary}</div>` : ''}
            <div class="card-meta">
                <span class="tag">${getCategoryName(item.category)}</span>
                <span>${item.date || item.time || '刚刚'}</span>
            </div>
        </div>
    `).join('');
}

// 辅助函数：分类名称美化
function getCategoryName(id) {
    const map = {
        'all': '全部',
        'politics': '时政要闻',
        'trade': '国际贸易',
        'cross_border': '跨境电商',
        'stocks': '股市动态',
        'tech': '科技前沿'
    };
    return map[id] || id;
}
