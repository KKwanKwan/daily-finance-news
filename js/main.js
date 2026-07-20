/**
 * Daily Finance Brief —— 强制溯源版 main.js
 * 1) 万能挖掘任意结构 JSON，按分类填格子
 * 2) 每张卡片强制显示【来源】与【原文链接】：有则展示/可点，缺则红字标出，绝不静默隐藏
 * 3) 顶部"数据溯源完整性"统计条，缺失一目了然，倒逼数据补全（不伪造任何出处）
 * 容器: politics-news / trade-news / ecommerce-news / stock-news / bond-news / fund-news / knowledge-content
 * 数据: data/news-data.json
 * 每条数据建议字段: title / summary / date / category / source(必填) / url(必填)
 */
(function () {
  'use strict';

  var DATA_URL = 'data/news-data.json';
  var IDS = ['politics-news', 'trade-news', 'ecommerce-news', 'stock-news', 'bond-news', 'fund-news', 'knowledge-content'];

  var CAT = [
    ['politics-news',     ['politic', '时政', '政治', '要闻']],
    ['trade-news',        ['trade', 'trading', '国际贸易', '贸易', '外贸']],
    ['ecommerce-news',    ['ecommerce', 'cross', '跨境', '电商']],
    ['stock-news',        ['stock', '股市', '股票', '证券', 'equity']],
    ['bond-news',         ['bond', '债', '债券', 'treasury']],
    ['fund-news',         ['fund', '基金', '理财', 'etf']],
    ['knowledge-content', ['knowledge', '知识', '科普', '百科']]
  ];

  var allNews = [];
  var rawText = '';
  var keyword = '';

  // ---------- 样式 ----------
  function injectStyle() {
    if (document.getElementById('dfb-style')) return;
    var s = document.createElement('style');
    s.id = 'dfb-style';
    s.textContent =
      '.dfb-card{display:block;background:var(--card-bg,#fff);border:1px solid var(--border,#eef0f3);' +
      'border-radius:12px;padding:14px 16px;margin:0 0 12px;color:inherit;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.04);transition:transform .2s,box-shadow .2s;}' +
      '.dfb-card:hover{box-shadow:0 8px 20px rgba(0,0,0,.08);border-color:var(--primary,#2563eb);}' +
      '.dfb-title{font-size:15px;font-weight:600;line-height:1.5;margin:0 0 6px;color:var(--text,#1a1a2e);}' +
      '.dfb-title-link{display:block;font-size:15px;font-weight:600;line-height:1.5;margin:0 0 6px;color:var(--text,#1a1a2e);text-decoration:none;}' +
      '.dfb-title-link:hover{color:var(--primary,#2563eb);text-decoration:underline;}' +
      '.dfb-summary{font-size:13px;line-height:1.6;color:var(--muted,#64748b);margin:0 0 8px;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.dfb-trace{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between;margin:8px 0 6px;font-size:12px;}' +
      '.dfb-source{color:var(--muted,#475569);font-weight:500;}' +
      '.dfb-link{color:var(--primary,#2563eb);text-decoration:none;font-weight:600;}' +
      '.dfb-link:hover{text-decoration:underline;}' +
      '.dfb-missing{color:#d93025 !important;background:#fff1f0;border:1px solid #ffccc7;border-radius:6px;padding:1px 7px;font-weight:600;}' +
      '.dfb-meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted,#94a3b8);}' +
      '.dfb-tag{padding:2px 8px;border-radius:6px;background:var(--tag-bg,#eff6ff);color:var(--primary,#2563eb);font-weight:500;}' +
      '.dfb-date{color:var(--muted,#94a3b8);}' +
      '.dfb-empty{padding:18px;text-align:center;color:var(--muted,#94a3b8);font-size:13px;}' +
      '.dfb-trace-bar{position:relative;z-index:50;max-width:1100px;margin:10px auto;padding:10px 16px;border-radius:10px;font-size:13px;line-height:1.6;border:1px solid;}' +
      '.dfb-trace-bar.ok{background:#f0fff4;border-color:#b7eb8f;color:#135200;}' +
      '.dfb-trace-bar.warn{background:#fffbe6;border-color:#ffe58f;color:#874d00;}' +
      '.dfb-trace-bar code{background:rgba(0,0,0,.06);padding:1px 5px;border-radius:4px;font-size:12px;}' +
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
  function U(o)   { return getVal(o, ['url', 'link', 'href', 'source_url', 'sourceUrl', '原文链接']); }
  function D(o)   { return getVal(o, ['date', 'time', 'publish_time', 'publishTime', 'pubDate', 'published_at', 'publishedAt', 'created_at', '日期', '时间']); }
  function SRC(o) { return getVal(o, ['source', 'from', 'media', 'site', 'publisher', '来源', '出处', '媒体']); }
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
      var isContainer = node.every(function (e) {
        if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
        return Object.keys(e).some(function (k) { return Array.isArray(e[k]) && e[k].length && isNewsItem(e[k][0]); });
      });
      if (isContainer) {
        for (var c = 0; c < node.length; c++) collect(node[c], hint(node[c]) || pathKey);
        return;
      }
      var items = [];
      for (var i = 0; i < node.length; i++) if (isNewsItem(node[i])) items.push(node[i]);
      if (items.length) {
        var cid = resolve(null, pathKey);
        for (var n = 0; n < items.length; n++) allNews.push({ it: items[n], cid: cid || resolve(C(items[n]), null) });
        return;
      }
      for (var k = 0; k < node.length; k++) collect(node[k], pathKey);
      return;
    }
    if (node && typeof node === 'object') {
      var keys = Object.keys(node);
      for (var p = 0; p < keys.length; p++) collect(node[keys[p]], keys[p]);
    }
  }

  // ---------- 卡片（强制溯源） ----------
  function card(it) {
    var t = T(it); if (!t) return '';
    var u = U(it), sum = S(it), d = D(it), src = SRC(it), cat = C(it);

    // 标题：有原文链接则可点，无则纯文本
    var titleHtml = u
      ? '<a class="dfb-title-link" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + '</a>'
      : '<h3 class="dfb-title">' + esc(t) + '</h3>';

    // 溯源行：来源 + 原文链接，强制显示，缺失红字标出
    var srcHtml = src
      ? '<span class="dfb-source">📰 来源：' + esc(src) + '</span>'
      : '<span class="dfb-source dfb-missing" title="该条目未提供数据来源，无法溯源，请在数据中补全 source 字段">📰 来源：未标注 ⚠️</span>';
    var linkHtml = u
      ? '<a class="dfb-link" href="' + esc(u) + '" target="_blank" rel="noopener" title="点击查看原始出处，核验真实性">🔗 查看原文 ↗</a>'
      : '<span class="dfb-link dfb-missing" title="该条目缺少原文链接，无法核验原文，请在数据中补全 url 字段">🔗 原文链接缺失 ⚠️</span>';
    var trace = '<div class="dfb-trace">' + srcHtml + linkHtml + '</div>';

    var meta = '<div class="dfb-meta">' +
      (cat ? '<span class="dfb-tag">' + esc(cat) + '</span>' : '<span></span>') +
      '<span class="dfb-date">' + esc(d) + '</span></div>';

    var inner = titleHtml + (sum ? '<p class="dfb-summary">' + esc(sum) + '</p>' : '') + trace + meta;
    return '<div class="dfb-card">' + inner + '</div>';
  }

  // ---------- 溯源完整性统计 ----------
  function traceReport() {
    var ms = 0, mu = 0, n = allNews.length;
    for (var i = 0; i < n; i++) { if (!SRC(allNews[i].it)) ms++; if (!U(allNews[i].it)) mu++; }
    return { n: n, ms: ms, mu: mu };
  }
  function showTraceBar() {
    var r = traceReport();
    var bar = document.getElementById('dfb-trace-bar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'dfb-trace-bar';
      var stats = document.getElementById('statsBar');
      if (stats && stats.parentNode) stats.parentNode.insertBefore(bar, stats.nextSibling);
      else document.body.insertBefore(bar, document.body.firstChild);
    }
    if (r.n === 0) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    var okSrc = r.n - r.ms, okUrl = r.n - r.mu;
    if (r.ms === 0 && r.mu === 0) {
      bar.className = 'dfb-trace-bar ok';
      bar.innerHTML = '✅ 数据溯源完整：全部 <b>' + r.n + '</b> 条均已标注来源与可点击原文链接。';
    } else {
      bar.className = 'dfb-trace-bar warn';
      bar.innerHTML = '⚠️ 数据溯源完整性：来源已标注 <b>' + okSrc + '/' + r.n + '</b>，原文链接 <b>' + okUrl + '/' + r.n + '</b>。' +
        '缺失项已在对应卡片上以红字标出。为保证真实性与可溯源，请在 <code>data/news-data.json</code> 中为每条新闻补全 ' +
        '<code>source</code>（来源媒体/机构）与 <code>url</code>（原文链接）字段，<b>切勿留空或伪造</b>。';
    }
  }

  // ---------- 渲染 ----------
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
    showTraceBar();
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
            '【typeof】 ' + typeof json + '\n【顶层结构】 ' + topInfo(json));
        }
      })
      .catch(function (e) { diag('red', '❌ 加载失败: ' + e.message + '\n目标路径: ' + DATA_URL); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
