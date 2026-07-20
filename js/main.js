/**
 * Daily Finance Brief —— 精确适配版 main.js
 * 适配容器: politics-news / trade-news / ecommerce-news / stock-news / bond-news / fund-news / knowledge-content
 * 数据路径: data/news-data.json (相对路径, 已验证 200)
 */
(function () {
  'use strict';

  var DATA_URL = 'data/news-data.json';
  var CONTAINERS = ['politics-news', 'trade-news', 'ecommerce-news', 'stock-news', 'bond-news', 'fund-news', 'knowledge-content'];

  // 分类关键词 -> 容器 id (双向模糊匹配, 大小写不敏感)
  var CAT_MAP = [
    ['politics-news',     ['politics', '时政', '政治', '要闻']],
    ['trade-news',        ['trade', '国际贸易', '贸易', '外贸']],
    ['ecommerce-news',    ['ecommerce', 'cross', '跨境', '电商']],
    ['stock-news',        ['stock', '股', '股市']],
    ['bond-news',         ['bond', '债', '债券']],
    ['fund-news',         ['fund', '基金', '理财']],
    ['knowledge-content', ['knowledge', '知识', '科普']]
  ];

  var allData = [];
  var keyword = '';

  // ---------- 局部样式 (只修饰自己生成的卡片, 绝不污染原页面) ----------
  function injectStyle() {
    if (document.getElementById('dfb-style')) return;
    var s = document.createElement('style');
    s.id = 'dfb-style';
    s.textContent =
      '.dfb-card{display:block;background:var(--card-bg,#fff);border:1px solid var(--border,#eef0f3);' +
      'border-radius:12px;padding:14px 16px;margin:0 0 12px;text-decoration:none;color:inherit;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.04);transition:transform .2s,box-shadow .2s;cursor:pointer;}' +
      '.dfb-card:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,.08);border-color:var(--primary,#2563eb);}' +
      '.dfb-title{font-size:15px;font-weight:600;line-height:1.5;margin:0 0 6px;color:var(--text,#1a1a2e);}' +
      '.dfb-summary{font-size:13px;line-height:1.6;color:var(--muted,#64748b);margin:0 0 10px;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.dfb-meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted,#94a3b8);}' +
      '.dfb-tag{padding:2px 8px;border-radius:6px;background:var(--tag-bg,#eff6ff);color:var(--primary,#2563eb);font-weight:500;}' +
      '.dfb-empty{padding:18px;text-align:center;color:var(--muted,#94a3b8);font-size:13px;}' +
      '.dfb-diag{position:relative;z-index:99999;background:#fff3f3;border:2px solid #e33;color:#222;' +
      'padding:12px;margin:10px;font:12px/1.6 monospace;white-space:pre-wrap;word-break:break-all;border-radius:8px;}';
    document.head.appendChild(s);
  }

  // ---------- 工具 ----------
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function getVal(item, keys) {
    for (var i = 0; i < keys.length; i++) { if (item[keys[i]] != null && item[keys[i]] !== '') return item[keys[i]]; }
    return '';
  }
  function titleOf(it)  { return getVal(it, ['title', 'name', 'headline', 't', '标题']); }
  function sumOf(it)    { return getVal(it, ['summary', 'desc', 'description', 'abstract', 'digest', 'content', 's', '摘要']); }
  function urlOf(it)    { return getVal(it, ['url', 'link', 'href', 'source_url', 'sourceUrl']); }
  function dateOf(it)   { return getVal(it, ['date', 'time', 'publish_time', 'publishTime', 'published_at', 'publishedAt', 'pubDate', 'created_at', '日期', '时间']); }
  function sourceOf(it) { return getVal(it, ['source', 'from', 'media', 'site', '来源']); }
  function catOf(it)    { return getVal(it, ['category', 'type', 'tag', 'section', 'cat', 'channel', '分类', '标签']); }

  // 把一条新闻归类到正确的容器 id
  function resolveContainerId(cat) {
    var c = String(cat || '').trim();
    if (!c) return null;
    var direct = c + '-news';                       // 快速路径: category 直接是前缀
    if (CONTAINERS.indexOf(direct) > -1) return direct;
    var low = c.toLowerCase();
    for (var i = 0; i < CAT_MAP.length; i++) {
      var kws = CAT_MAP[i][1];
      for (var j = 0; j < kws.length; j++) {
        var k = kws[j].toLowerCase();
        if (low.indexOf(k) > -1 || k.indexOf(low) > -1) return CAT_MAP[i][0];
      }
    }
    return null;
  }

  function cardHTML(it) {
    var t = titleOf(it); if (!t) return '';
    var u = urlOf(it), sum = sumOf(it), d = dateOf(it), src = sourceOf(it), cat = catOf(it);
    var meta = '<div class="dfb-meta">' +
      (cat ? '<span class="dfb-tag">' + esc(cat) + '</span>' : '<span></span>') +
      '<span>' + esc(src ? (src + (d ? ' · ' : '')) : '') + esc(d) + '</span></div>';
    var inner = '<h3 class="dfb-title">' + esc(t) + '</h3>' +
      (sum ? '<p class="dfb-summary">' + esc(sum) + '</p>' : '') + meta;
    return u
      ? '<a class="dfb-card" href="' + esc(u) + '" target="_blank" rel="noopener">' + inner + '</a>'
      : '<div class="dfb-card">' + inner + '</div>';
  }

  // ---------- 渲染 ----------
  function renderAll() {
    var kw = keyword.toLowerCase();
    var buckets = {}; CONTAINERS.forEach(function (id) { buckets[id] = []; });
    var unmatched = 0, shown = 0;

    allData.forEach(function (it) {
      if (kw) {
        var hay = (titleOf(it) + ' ' + sumOf(it) + ' ' + catOf(it)).toLowerCase();
        if (hay.indexOf(kw) < 0) return;
      }
      var cid = resolveContainerId(catOf(it));
      if (cid && buckets[cid]) buckets[cid].push(it);
      else unmatched++;
      shown++;
    });

    var totalRendered = 0;
    CONTAINERS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var list = buckets[id];
      if (list && list.length) {
        el.innerHTML = list.map(cardHTML).join('');
        totalRendered += list.length;
      } else {
        el.innerHTML = '<div class="dfb-empty">' + (kw ? '没有匹配的资讯 🧐' : '暂无相关资讯') + '</div>';
      }
    });

    // 统计条 / 无结果提示
    var stats = document.getElementById('statsBar');
    if (stats) stats.textContent = '📊 共 ' + allData.length + ' 条' + (kw ? ' · 匹配 ' + shown + ' 条' : '');
    var noRes = document.getElementById('noResult');
    if (noRes) noRes.style.display = (kw && shown === 0) ? '' : 'none';

    // 自适应诊断: 数据有, 但一条都没渲染出来 -> 打印 JSON 真实结构给我看
    if (totalRendered === 0 && allData.length > 0) {
      var cats = {}; allData.forEach(function (it) { cats[String(catOf(it))] = 1; });
      diag('⚠️ 数据加载成功(' + allData.length + '条), 但没匹配到任何分类格子。\n' +
        '请把下面信息截图发给助手:\n\n' +
        '【JSON 第一条的所有字段名】\n' + Object.keys(allData[0]).join(', ') + '\n\n' +
        '【category 字段的全部取值】\n' + Object.keys(cats).join(', ') + '\n\n' +
        '【第一条样本】\n' + JSON.stringify(allData[0], null, 2));
    }
  }

  function diag(msg) {
    if (document.getElementById('dfb-diag')) return;
    var b = document.createElement('div'); b.id = 'dfb-diag'; b.className = 'dfb-diag';
    b.textContent = msg; document.body.insertBefore(b, document.body.firstChild);
  }
  function showError(err) {
    diag('❌ 加载数据失败: ' + err.message + '\n目标路径: ' + DATA_URL +
      '\n\n请确认仓库里有 data/news-data.json, 并强制刷新(Ctrl+F5)。');
  }

  // ---------- 数据加载 ----------
  function load() {
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        allData = Array.isArray(json) ? json : (json.news || json.data || json.items || json.list || []);
        if (!Array.isArray(allData)) allData = [];
        renderAll();
      })
      .catch(showError);
  }

  // ---------- 交互 (全部防御式: 元素不存在就静默跳过) ----------
  function bindSearch() {
    var el = document.getElementById('searchInput'); if (!el) return;
    el.addEventListener('input', function () { keyword = el.value.trim(); renderAll(); });
  }
  function bindTabs() {
    var nav = document.getElementById('tabNav'); if (!nav) return;
    var btns = nav.querySelectorAll('button, a'); if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function (e) {
        var txt = (b.textContent || '').toLowerCase();
        if (/总览|全部|首页|all|home/.test(txt)) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        var target = null;
        for (var i = 0; i < CAT_MAP.length; i++) {
          var kws = CAT_MAP[i][1];
          for (var j = 0; j < kws.length; j++) if (txt.indexOf(kws[j].toLowerCase()) > -1) { target = CAT_MAP[i][0].replace('-news', '').replace('-content', ''); break; }
          if (target) break;
        }
        var anchor = target ? document.getElementById(target) : null;
        if (anchor) { e.preventDefault(); anchor.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });
  }
  function bindTheme() {
    var btn = document.getElementById('themeToggle'); if (!btn) return;
    var CLS = ['dark', 'dark-mode', 'theme-dark', 'night', 'is-dark'];
    function isDark() { return CLS.some(function (c) { return document.documentElement.classList.contains(c) || document.body.classList.contains(c); }); }
    function setDark(on) { CLS.forEach(function (c) { document.documentElement.classList.toggle(c, on); document.body.classList.toggle(c, on); }); try { localStorage.setItem('dfb-theme', on ? 'dark' : 'light'); } catch (e) {} }
    var saved = null; try { saved = localStorage.getItem('dfb-theme'); } catch (e) {}
    setDark(saved ? saved === 'dark' : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    btn.addEventListener('click', function () { setDark(!isDark()); });
  }
  function bindBackTop() {
    var el = document.getElementById('backTop'); if (!el) return;
    el.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('scroll', function () { el.style.display = window.scrollY > 300 ? '' : 'none'; });
  }
  function bindArchive() {
    var btn = document.getElementById('archiveBtn'), modal = document.getElementById('archiveModal'),
        close = document.getElementById('archiveClose'), list = document.getElementById('archiveList');
    if (list && !list.children.length) list.innerHTML = '<div class="dfb-empty">暂无往期归档数据</div>';
    function show(on) { if (!modal) return; modal.style.display = on ? 'flex' : 'none'; modal.classList.toggle('show', on); modal.classList.toggle('active', on); }
    if (btn) btn.addEventListener('click', function () { show(true); });
    if (close) close.addEventListener('click', function () { show(false); });
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) show(false); });
  }

  // ---------- 启动 ----------
  function init() {
    injectStyle();
    bindTheme(); bindBackTop(); bindArchive(); bindTabs(); bindSearch();
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
