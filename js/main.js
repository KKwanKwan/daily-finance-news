/**
 * Daily Finance Brief - Robust Version
 * 增加：路径容错、加载状态反馈、卡片交互优化
 */

// --- 核心配置 (请根据实际情况微调) ---
const CONFIG = {
    // 如果你的 json 在根目录，用 'news-data.json'
    // 如果在 data 文件夹下，用 'data/news-data.json'
    dataUrl: 'news-data.json', 
    
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

// --- 初始化入口 ---
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    fetchData(); // 开始抓取数据
    
    // 绑定搜索功能
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterAndRender(e.target.value);
        });
    }
});

// --- 1. 数据获取逻辑 (带详细报错) ---
async function fetchData() {
    const container = document.getElementById('news-container');
    if (!container) return;

    try {
        // 显示加载状态
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">正在获取最新情报...</div>';
        
        const response = await fetch(CONFIG.dataUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 兼容两种数据格式：数组 或 { news: [...] }
        allNewsData = Array.isArray(data) ? data : (data.news || []);
        
        console.log(`成功加载 ${allNewsData.length} 条新闻`);
        renderNews(); // 渲染页面
        
    } catch (error) {
        console.error('Fetch error:', error);
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:red;">
                <h3>⚠️ 数据加载失败</h3>
                <p>无法读取配置文件: ${CONFIG.dataUrl}</p>
                <p>请检查文件是否存在，或路径是否正确。</p>
                <p style="font-size:12px; color:#999;">错误详情: ${error.message}</p>
            </div>
        `;
    }
}

// --- 2. 渲染逻辑 ---
function renderNews(filterText = '') {
    const container = document.getElementById('news-container');
    if (!container) return;

    // 过滤数据
    let displayData = allNewsData.filter(item => {
        // 分类过滤
        const categoryMatch = currentCategory === 'all' || item.category === currentCategory;
        // 搜索过滤
        const text = filterText.toLowerCase();
        const searchMatch = !text || 
                            (item.title && item.title.toLowerCase().includes(text)) || 
                            (item.summary && item.summary.toLowerCase().includes(text));
        return categoryMatch && searchMatch;
    });

    if (displayData.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">暂无相关内容 🧐</div>';
        return;
    }

    // 生成 HTML
    const html = displayData.map(item => createCardHTML(item)).join('');
    container.innerHTML = html;
}

// --- 3. 卡片生成 (包含点击跳转逻辑) ---
function createCardHTML(item) {
    // 如果没有链接，使用 # 占位
    const link = item.url || item.source_url || '#';
    
    // 样式类名
    const tagClass = `tag tag-${item.category || 'default'}`;
    const categoryName = getCategoryName(item.category);

    return `
        <article class="card" onclick="window.open('${link}', '_blank')">
            <div class="card-header">
                <span class="${tagClass}">${categoryName}</span>
                <span class="date">${item.date || ''}</span>
            </div>
            <h3 class="title">${item.title}</h3>
            <p class="summary">${item.summary || '暂无摘要，点击查看详情...'}</p>
            <div class="card-footer">
                <span class="source">📰 ${item.source || '未知来源'}</span>
                <span class="read-more">阅读全文 &rarr;</span>
            </div>
        </article>
    `;
}

// --- 辅助函数 ---
function initTabs() {
    const tabContainer = document.getElementById('tabs');
    if(!tabContainer) return;

    let tabsHtml = `<button class="tab-btn active" onclick="switchTab('all', this)">全部</button>`;
    CONFIG.categories.forEach(cat => {
        if(cat.id !== 'all') {
            tabsHtml += `<button class="tab-btn" onclick="switchTab('${cat.id}', this)">${cat.name}</button>`;
        }
    });
    tabContainer.innerHTML = tabsHtml;
}

function switchTab(categoryId, btnElement) {
    currentCategory = categoryId;
    
    // 更新按钮样式
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    
    // 重新渲染
    const searchInput = document.getElementById('search-input');
    renderNews(searchInput ? searchInput.value : '');
}

function getCategoryName(id) {
    const found = CONFIG.categories.find(c => c.id === id);
    return found ? found.name : '资讯';
}

function filterAndRender(text) {
    renderNews(text);
}
