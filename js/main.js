/**
 * Daily Finance Brief - Main Logic v2
 * 严格匹配 style.css 中的类名与 ID
 */

const CONFIG = {
    dataUrl: 'data/news-data.json',
    categories: [
        { id: 'all', name: '总览' },
        { id: 'politics', name: '时政要闻' },
        { id: 'trade', name: '国际贸易' },
        { id: 'ecommerce', name: '跨境电商' },
        { id: 'stock', name: '股市动态' },
        { id: 'bond', name: '债券市场' },
        { id: 'fund', name: '基金理财' }
    ]
};

let allNewsData = [];
let currentCategory = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    initTabs();
    initSearch();
    initDarkMode();
    initBackToTop();
});

async function fetchData() {
    const container = document.getElementById('news-container');
    container.innerHTML = '<div class="loading-spinner">加载中</div>';
    
    try {
        const response = await fetch(CONFIG.dataUrl + '?t=' + Date.now());
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const raw = await response.json();
        
        // 将嵌套结构扁平化为统一数组，兼容现有 JSON 格式
        allNewsData = [];
        CONFIG.categories.forEach(cat => {
            if (cat.id === 'all') return;
            const items = raw[cat.id] || [];
            items.forEach(item => {
                allNewsData.push({
                    ...item,
                    category: cat.id,
                    url: item.source_url || item.url || '#',
                    source: item.source_name || '未知来源',
                    tags: item.tags || []
                });
            });
        });
        
        // 按日期降序排列
        allNewsData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        
        renderStats();
        filterAndRender();
    } catch (error) {
        console.error('加载失败:', error);
        container.innerHTML = `<div class="empty-state">数据加载失败<br><small>${error.message}</small><br>请检查 data/news-data.json 是否存在</div>`;
    }
}

function renderStats() {
    const sources = new Set(allNewsData.map(n => n.source)).size;
    const el = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
    el('stat-count', allNewsData.length);
    el('stat-source', sources);
    el('stat-sections', CONFIG.categories.length - 1);
}

function filterAndRender() {
    let filtered = allNewsData;
    if (currentCategory !== 'all') {
        filtered = filtered.filter(n => n.category === currentCategory);
    }
    if (searchQuery) {
        filtered = filtered.filter(n =>
            (n.title || '').toLowerCase().includes(searchQuery) ||
            (n.summary || '').toLowerCase().includes(searchQuery) ||
            n.tags.some(t => t.toLowerCase().includes(searchQuery))
        );
    }
    renderNews(filtered);
}

function renderNews(data) {
    const container = document.getElementById('news-container');
    container.innerHTML = '';
    
    if (!data.length) {
        container.innerHTML = '<div class="empty-state">暂无匹配的新闻</div>';
        return;
    }
    
    data.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'news-card fade-in';
        card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;
        
        // 全卡片点击跳转
        card.onclick = (e) => {
            if (e.target.closest('a')) return; // 不拦截链接自身点击
            window.open(item.url, '_blank');
        };
        
        const tagsHtml = item.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('');
        const badgeColor = strColor(item.source);
        
        card.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">${esc(item.title)}</h3>
            </div>
            <p class="card-summary">${esc(item.summary || '暂无摘要')}</p>
            ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
            <div class="card-footer">
                <div class="source-info">
                    <span class="source-badge" style="background:${badgeColor}">${esc(item.source.charAt(0))}</span>
                    <span class="source-name">${esc(item.source)}</span>
                    <span class="publish-date">${esc(item.date || '')}</span>
                </div>
                <a href="${esc(item.url)}" target="_blank" rel="noopener" class="read-more" onclick="event.stopPropagation()">查看原文 ↗</a>
            </div>
        `;
        container.appendChild(card);
    });
}

function initTabs() {
    const container = document.getElementById('tab-container');
    if (!container) return;
    container.innerHTML = CONFIG.categories.map(c =>
        `<button class="tab-btn ${c.id === 'all' ? 'active' : ''}" data-id="${c.id}">${c.name}</button>`
    ).join('');
    
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelector('.active')?.classList.remove('active');
            btn.classList.add('active');
            currentCategory = btn.dataset.id;
            filterAndRender();
        });
    });
}

function initSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let timer;
    input.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            searchQuery = e.target.value.trim().toLowerCase();
            filterAndRender();
        }, 200); // 防抖，避免每次按键都重渲染
    });
}

function initDarkMode() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const saved = localStorage.getItem('dfb-theme');
    const prefer = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefer)) {
        document.body.classList.add('dark-mode');
        btn.textContent = '☀️';
    }
    btn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        btn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('dfb-theme', isDark ? 'dark' : 'light');
    });
}

function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 400), { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// 工具函数
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function strColor(s) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return `hsl(${Math.abs(h) % 360}, 55%, 48%)`; }
