/**
 * Daily Finance Brief —— 万能适配版 main.js
 * 自动挖掘任意结构的 news-data.json，按分类填入对应格子。
 * 容器: politics-news / trade-news / ecommerce-news / stock-news / bond-news / fund-news / knowledge-content
 * 数据: data/news-data.json (相对路径)
 */
(function () {
  'use strict';

  var DATA_URL = 'data/news-data.json';
  var IDS = ['politics-news', 'trade-news', 'ecommerce-news', 'stock-news', 'bond-news', 'fund-news', 'knowledge-content'];

  // 分类关键词（同时用于 category 字段 和 JSON 里的键名，大小写/横线/下划线不敏感）
  var CAT = [
    ['politics-news',     ['politic', '时政', '政治', '要闻']],
    ['trade-news',        ['trade', 'trading', '国际贸易', '贸易', '外贸']],
    ['ecommerce-news',    ['ecommerce', 'cross', '跨境', '电商']],
    ['stock-news',        ['stock', '股市', '股票', '证券', 'equity']],
    ['bond-news',         ['bond', '债', '债券', 'treasury']],
    ['fund-news',         ['fund', '基金', '理财', 'etf']],
    ['knowledge-content', ['knowledge', '知识', '科普', '百科']]
  ];

  var allNews = [];   // [{it, cid}]
  var rawText = '';
  var keyword = '';

  // ---------- 样式 ----------
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
      '.dfb-diag{position:relative;z-index:99999;padding:12px 14px;margin:10px;font:12px/1.7 monospace;' +
      'white-space:pre-wrap;word-break:break-all;border-radius:8px;border:2px solid;}' +
      '.dfb-diag.red{background:#fff3f3;border-color:#e33;color:#222;}' +
      '.dfb-diag.yellow{background:#fffbe6;border-color:#d90;color:#222;}';
    document.head.appendChild(s);
  }

  // ---------- 工具 ----------
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function getVal(o, ks) { for (var i = 0; i < ks.length; i++) if (o[ks[i]] != null && o[ks[i]] !== '') return o[ks[i]]; return ''; }
  function T(o)   { return getVal(o, ['title', 'name', 'headline', 't', '标题', '名称']); }
  function S(o)   { return getVal(o, ['summary', 'desc', 'description', 'abstract', 'digest', 'content', 's', '摘要', '简介']); }
  function U(o)   { return getVal(o, ['url', 'link', 'href', 'source_url', 'sourceUrl']); }
  function D(o)   { return getVal(o, ['date', 'time', 'publish_time', 'publishTime', 'pubDate', 'published_at', 'publishedAt', 'created_at', '日期', '时间']); }
  function SRC(o) { return getVal(o, ['source', 'from', 'media', 'site', '来源']); }
  function C(o)   { return getVal(o, ['category', 'type', 'tag', 'section', 'cat', 'channel', '分类', '标签', '类别']); }
  function hint(o){ return getVal(o, ['category', 'name', 'type', 'label', 'tag', 'section', 'channel', '分类', '名称', '类别']); }
  function norm(s){ return String(s == null ? '' : s).toLowerCase().replace(/[-_\s]/g, ''); }

  function isNewsItem(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    var ks = Object.keys(o); if (!ks.length) return false;
    var hit = ['title', 'name', 'headline', 't', '标题', '名称', 'url', 'link', 'href', 'source_url', 'sourceUrl',
      'summary', 'desc', 'description', 'abstract', 'digest', 'content', '摘要', '简介'];
    for (var i = 0; i < hit.length; i++) if (o[hit[i]] != null && o[hit[i]] !== '') return true;
    if (ks.length >= 2) for (var j = 0; j < ks.length; j++) if (typeof o[ks[j]] === 'string' && o[ks[j]].trim()) return true;
    return false;
  }

  function resolve(cat, pathKey) {
    var cands = [cat, pathKey];
    for (var ci = 0; ci < cands.length; ci++) {
      var c = String(cands[ci] || '').trim(); if (!c) continue;
      var direct = norm(c) + '-news';
      for (var d = 0; d < IDS.length; d++) if (norm(IDS[d]).indexOf(norm(c)) === 0 || norm(IDS[d]) === direct) return IDS[d];
      var low = norm(c);
      for (var a = 0; a < CAT.length; a++) {
        var kw = CAT[a][1];
        for (var b = 0; b < kw.length; b++) {
          var k = norm(kw[b]); if (!k) continue;
          if (low.indexOf(k) > -1 || k.indexOf(low) > -1) return CAT[a][0];
        }
      }
    }
    return null;
  }

  // ---------- 万能递归挖掘 ----------
  function collect(node, pathKey) {
    if (Array.isArray(node)) {
      if (node.length === 0) return;
      // 是不是“分类容器对象数组”：每个元素内部含一个“新闻子数组”
      var isContainer = node.every(function (e) {
        if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
        return Object.keys(e).some(function (k) { return Array.isArray(e[k]) && e[k].length && isNewsItem(e[k][0]); });
      });
      if (isContainer) {
        for (var c = 0; c < node.length; c++) collect(node[c], hint(node[c]) || pathKey);
        return;
      }
      // 普通新闻数组
      var items = [];
      for (var i = 0; i < node.length; i++) if (isNewsItem(node[i])) items.push(node[i]);
      if (items.length) {
        var cid = resolve(null, pathKey);
        for (var n = 0; n < items.length; n++) {
          allNews.push({ it: items[n], cid: cid || resolve(C(items[n]), null) });
        }
        return;
      }
      // 既非容器也非新闻数组，递归元素
      for (var k = 0; k < node.length; k++) collect(node[k], pathKey);
      return;
    }
    if (node && typeof node === 'object') {
      var keys = Object.keys(node);
      for (var p = 0; p < keys.length; p++) collect(node[keys[p]], keys[p]);
    }
  }

  // ---------- 渲染 ----------
  function card(it) {
    var t = T(it); if (!t) return '';
    var u = U(it), sum = S(it), d = D(it), src = SRC(it), cat = C(it);
    var meta = '<div class="dfb-meta">' +
      (cat ? '<span class="dfb-tag">' + esc(cat) + '</span>' : '<span></span>') +
      '<span>' + esc(src ? (src + (d ? ' · ' : '')) : '') + esc(d) + '</span></div>';
    var inner = '<h3 class="dfb-title">' + esc(t) + '</h3>' + (sum ? '<p class="dfb-summary">' + esc(sum) + '</p>' : '') + meta;
    return u ? '<a class="dfb-card" href="' + esc(u) + '" target="_blank" rel="noopener">' + inner + '</a>'
             : '<div class="dfb-card">' + inner + '</div>';
  }

  function render(kw) {
    kw = (kw || '').toLowerCase();
    var tmp = {}; IDS.forEach(function (id) { tmp[id] = []; });
    var shown = 0;
    allNews.forEach(function (e) {
      if (kw) { var hay = (T(e.it) + ' ' + S(e.it) + ' ' + C(e.it)).toLowerCase(); if (hay.indexOf(kw) < 0) return; }
      tmp[e.cid || IDS[0]].push(e.it); shown++;
    });
    var total = 0;
    IDS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var list = tmp[id]; total += list.length;
      el.innerHTML = list.length ? list.map(card).join('') : '<div class="dfb-empty">暂无相关资讯</div>';
    });
    var stats = document.getElementById('statsBar');
    if (stats) stats.textContent = '📊 共 ' + allNews.length + ' 条' + (kw ? ' · 匹配 ' + shown + ' 条' : '');
    var noRes = document.getElementById('noResult');
    if (noRes) noRes.style.display = (kw && shown === 0) ? '' : 'none';
    return total;
  }

  // ---------- 诊断 ----------
  function topInfo(json) {
    if (Array.isArray(json)) return '数组, 长度 ' + json.length;
    if (json && typeof json === 'object') return '对象, 顶层键: ' + Object.keys(json).join(', ');
    return String(json).slice(0, 60);
  }
  function diag(level, msg) {
    var old = document.getElementById('dfb-diag'); if (old) old.parentNode.removeChild(old);
    var b = document.createElement('div'); b.id = 'dfb-diag'; b.className = 'dfb-diag ' + level;
    b.textContent = msg; document.body.insertBefore(b, document.body.firstChild);
  }

  // ---------- 交互 ----------
  function bindSearch() {
    var el = document.getElementById('searchInput'); if (!el) return;
    el.addEventListener('input', function () { keyword = el.value.trim(); render(keyword); });
  }
  function bindTabs() {
    var nav = document.getElementById('tabNav'); if (!nav) return;
    var btns = nav.querySelectorAll('button, a'); if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function (e) {
        var txt = (b.textContent || '').toLowerCase();
        if (/总览|全部|首页|all|home/.test(txt)) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        for (var i = 0; i < CAT.length; i++) {
          var kws = CAT[i][1];
          for (var j = 0; j < kws.length; j++) {
            if (txt.indexOf(kws[j].toLowerCase()) > -1) {
              var anchorId = CAT[i][0].replace('-news', '').replace('-content', '');
              var anchor = document.getElementById(anchorId);
              if (anchor) { e.preventDefault(); anchor.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
              return;
            }
          }
        }
      });
    });
  }
  function bindTheme() {
    var btn = document.getElementById('themeToggle'); if (!btn) return;
    var CLS = ['dark', 'dark-mode', 'theme-dark', 'night', 'is-dark'];
    function isDark() { return CLS.some(function (c) { return document.documentElement.classList.contains(c) || document.body.classList.contains(c); }); }
    function setDark(on) { CLS.forEach(function (c) { document.documentElement.classList.toggle(c, on); document.body.classList.toggle(c, on); }); try { localStorage.setItem('dfb-theme', on ? 'dark' : 'light'); } catch (e) {} }
    var saved = null; try { saved = localStorage.getItem('dfb-theme'); } catch (e) {}
    setDark(saved ? saved === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    btn.addEventListener('click', function () { setDark(!isDark()); });
  }
  function bindBackTop() {
    var el = document.getElementById('backTop'); if (!el) return;
    el.style.display = 'none';
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
    var leftover = document.getElementById('dfb-diag'); if (leftover) leftover.parentNode.removeChild(leftover);
    bindTheme(); bindBackTop(); bindArchive(); bindTabs(); bindSearch();

    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (txt) {
        rawText = txt;
        var json;
        try { json = JSON.parse(txt); } catch (e) { throw new Error('JSON 解析失败: ' + e.message); }
        allNews = [];
        collect(json, '');
        render('');

        if (allNews.length === 0) {
          diag('red',
            '❌ 数据文件里没有可识别的新闻条目。\n\n' +
            '【原始 JSON 文本前 800 字】\n' + rawText.slice(0, 800) + '\n\n' +
            '【typeof】 ' + typeof json + '\n' +
            '【顶层结构】 ' + topInfo(json) + '\n\n' +
            '→ 如果上面显示 [] 或 {}，说明 news-data.json 是空的，需要往里面填新闻数据；\n' +
            '→ 如果是其它结构，请把这一整段截图发给助手，即可一次对齐。');
        } else {
          var nullCount = 0;
          for (var i = 0; i < allNews.length; i++) if (!allNews[i].cid) nullCount++;
          if (nullCount === allNews.length) {
            diag('yellow',
              '⚠️ 已成功渲染 ' + allNews.length + ' 条，但 JSON 里没有可识别的分类字段，\n' +
              '因此全部暂时放在“时政要闻”栏。\n如需正确分栏，请把下面片段发给助手：\n\n' + rawText.slice(0, 500));
          }
        }
      })
      .catch(function (e) { diag('red', '❌ 加载失败: ' + e.message + '\n目标路径: ' + DATA_URL); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
