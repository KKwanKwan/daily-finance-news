/**
 * Daily Finance Brief - Main Logic
 * 包含：渲染卡片、全卡片点击跳转、搜索、Tab切换、暗色模式
 */

// --- 配置项 ---
const CONFIG = {
    dataUrl: 'data/news-data.json', // 确保你的数据文件路径正确
    categories: [
        { id: 'all', name: '总览' },
        { id: 'politics', name: '时政要闻' },
        { id: 'trade', name: '国际贸易' },
        { id: 'cross_border', name: '跨境电商' },
        { id: 'stocks', name: '股市动态' },
        { id: 'bonds', name: '债券市场' },
        { id: 'funds', name: '基金理财' }
    ]
};

// --- 全局状态 ---
let allNewsData = [];
let currentCategory = 'all';
let searchQuery = '';

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    initTabs();
    initSearch();
    initDarkMode();
});

// 1. 获取数据
async function fetchData() {
    try {
        const response = await fetch(CONFIG.dataUrl);
        if (!response.ok) throw new Error('网络请求失败');
        allNewsData = await response.json();
        
        // 初始化完成后渲染
        renderStats(allNewsData);
        renderNews(allNewsData);
    } catch (error) {
        console.error('加载数据出错:', error);
        document.getElementById('news-container').innerHTML = 
            '<p style="text-align:center; color:#666;">数据加载失败，请稍后刷新重试。</p>';
    }
}

// 2. 渲染统计栏
function renderStats(data) {
    const sources = new Set(data.map(item => item.source)).size;
    document.getElementById('stat-count').textContent = data.length;
    document.getElementById('stat-source').textContent = sources;
    // 其他统计项可根据需要扩展
}

// 3. 渲染新闻列表
function renderNews(data) {
    const container = document.getElementById('news-container');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无相关新闻</div>';
        return;
    }

    data.forEach(item => {
        const card = createCardElement(item);
        container.appendChild(card);
    });
}

// 4. 创建卡片 DOM (核心修改：整卡可点)
function createCardElement(item) {
    const article = document.createElement('article');
    article.className = 'news-card fade-in';
    
    // 关键逻辑：点击卡片任意位置跳转
    // 除非点击的是特定的交互按钮（如果有）
    article.onclick = (e) => {
        // 如果点击的是链接本身，不重复触发
        if (e.target.tagName === 'A') return;
        window.open(item.url, '_blank');
    };

    // 标签处理
    const tagsHtml = (item.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('');

    article.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${item.title}</h3>
            ${item.is_hot ? '<span class="badge-hot">热点</span>' : ''}
        </div>
        <p class="card-summary">${item.summary || '暂无摘要...'}</p>
        <div class="card-tags">${tagsHtml}</div>
        <div class="card-footer">
            <div class="source-info">
                <span class="source-badge" style="background:${getSourceColor(item.source)}">
                    ${getSourceIcon(item.source)}
                </span>
                <span class="source-name">${item.source}</span>
                <span class="publish-date">${item.date}</span>
            </div>
            <a href="${item.url}" target="_blank" class="read-more" onclick="event.stopPropagation()">
                查看原文 ↗
            </a>
        </div>
    `;
    
    return article;
}

// 5. Tab 切换逻辑
function initTabs() {
    const tabContainer = document.getElementById('tab-container');
    // 清空并重新生成 Tab
    tabContainer.innerHTML = CONFIG.categories.map(cat => `
        <button class="tab-btn ${cat.id === 'all' ? 'active' : ''}" 
                data-id="${cat.id}">
            ${cat.name}
        </button>
    `).join('');

    // 绑定点击事件
    tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // UI 更新
            document.querySelector('.tab-btn.active').classList.remove('active');
            e.target.classList.add('active');
            
            // 数据过滤
            currentCategory = e.target.dataset.id;
            filterAndRender();
        });
    });
}

// 6. 搜索逻辑
function initSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        filterAndRender();
    });
}

// 7. 统一过滤与渲染函数
function filterAndRender() {
    let filtered = allNewsData;

    // 分类过滤
    if (currentCategory !== 'all') {
        filtered = filtered.filter(item => item.category === currentCategory);
    }

    // 搜索过滤
    if (searchQuery) {
        filtered = filtered.filter(item => 
            item.title.toLowerCase().includes(searchQuery) || 
            (item.summary && item.summary.toLowerCase().includes(searchQuery))
        );
    }

    renderNews(filtered);
}

// 8. 暗色模式逻辑
function initDarkMode() {
    const toggleBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        toggleBtn.textContent = '☀️';
    }

    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        toggleBtn.textContent = isDark ? '☀️' : '🌙';
    });
}

// --- 辅助工具函数 ---

function getSourceColor(source) {
    // 简单的哈希颜色生成，保证同一来源颜色固定
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
        hash = source.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
}

function getSourceIcon(source) {
    // 取首字作为图标
    return source.charAt(0);
}
