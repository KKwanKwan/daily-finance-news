/**
 * Daily Finance Brief —— 诚实溯源版 main.js
 * 溯源三档(视觉严格区分, 绝不把兜底伪装成确证):
 *   来源: 确证(数据source, 黑) / 推断一手源头(橙, 标"建议核实") / 无法判定(红)
 *   链接: 精确原文(数据非首页url, 蓝) / 检索直达(青, 一步定位) / 站点首页(灰, 标明非精确)
 *   知识角: 额外显示 紫色"📚参考出处"(事实性权威源: 法条/教材/官方机构, 可独立核验)
 * 顶部统计条分别计数, 全确证+全精确才绿, 否则黄并说明兜底性质与"如何全绿"。
 * 容器: politics-news / trade-news / ecommerce-news / stock-news / bond-news / fund-news / knowledge-content
 * 数据: data/news-data.json   建议每条字段: title/summary/date/category/source(真实)/url(精确原文)
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

  // 一手权威源头推断规则(标题/分类关键词 -> 法定/一手发布方)。事实性映射, 非伪造。
  var SRC_RULES = [
    [['gdp', 'cpi', 'ppi', 'pmi', '统计', '工业增加值', '社零', '社会消费品', '居民收入'], '国家统计局'],
    [['国务院', '常务会议', '国常会', '政策部署', '国办'], '新华社 · 中国政府网'],
    [['央行', '人民银行', '降准', '降息', 'lpr', 'mlf', '逆回购', '货币政策', '公开市场操作', '外汇局', '外汇储备'], '中国人民银行 / 国家外汇管理局'],
    [['中美', '经贸高层', '对话', '外交', '外交部', '双边关系'], '新华社 · 外交部'],
    [['外贸', '进出口', '海关', '贸易统计', '顺差', '逆差'], '海关总署'],
    [['商务部', '贸易救济', '反倾销', '反补贴', '外资', '外商投资', '自贸'], '商务部'],
    [['wto', '世贸'], '世界贸易组织 (WTO)'],
    [['跨境电商', '9610', '1210', '跨境零售', '海外仓'], '商务部 · 海关总署'],
    [['a股', '沪指', '上证', '深指', '深证', '创业板', '科创板', '沪深', '两市', '成交额', '板块', '涨停', '跌停', '北交所'], '沪深交易所 · 中证指数公司'],
    [['美股', '道指', '标普', '纳指', '纳斯达克', '纽交所', '英伟达', '中概'], 'NYSE / NASDAQ / 标普道琼斯指数'],
    [['国债', '国开债', '收益率', '债市', '地方债', '信用债'], '中国债券信息网 · 中央结算公司'],
    [['美债', '美国国债'], '美国财政部 (U.S. Treasury)'],
    [['基金', 'etf', '净值', '公募', '私募', '申购', '赎回', '基金经理'], '中国证券投资基金业协会 · 基金公司公告']
  ];
  var CAT_SRC = {
    'politics-news': '新华社 · 中国政府网', 'trade-news': '商务部 · 海关总署',
    'ecommerce-news': '商务部 · 海关总署', 'stock-news': '沪深交易所 · 中证指数公司',
    'bond-news': '中国债券信息网 · 中央结算公司', 'fund-news': '中国证券投资基金业协会',
    'knowledge-content': '权威教材 / 官方法规（见下方参考出处）'
  };

  // 知识角事实性权威参考表(关键词 -> 该引用的权威出处 + 检索增强词)。可独立核验, 非伪造。
  var KNOW_REF = [
    [['301', '三零一'], '美国《1974年贸易法》第301条；美国贸易代表办公室(USTR)「301调查」官方说明；《国际经济法》《国际贸易》教材', '301条款 美国贸易法 USTR 301调查'],
    [['关税'], '《中华人民共和国关税法》；海关总署关税征管说明；《国际贸易》《财政学》教材', '关税 定义 海关总署 关税法'],
    [['贸易战', '关税战', '贸易摩擦'], 'USTR 官方报告；WTO 贸易政策审议；国际政治经济学文献', '贸易战 关税战 301 WTO 贸易摩擦'],
    [['汇率', '外汇'], '《国际金融》教材；国家外汇管理局；IMF 汇率制度说明', '汇率 外汇 定义 国家外汇管理局 IMF'],
    [['通胀', '通货膨胀', 'cpi'], '《宏观经济学》(曼昆)；国家统计局 CPI 编制说明', 'CPI 通货膨胀 定义 国家统计局'],
    [['gdp', '国内生产总值'], '《宏观经济学》；国家统计局 GDP 核算说明；联合国 SNA 国民账户体系', 'GDP 国内生产总值 定义 国家统计局'],
    [['债券', '国债', '收益率'], '《金融市场学》《货币银行学》；中国债券信息网 / 中央结算公司', '国债 债券 收益率 定义 中国债券信息网'],
    [['基金', 'etf', '净值'], '《证券投资基金》教材；《投资学》(博迪)；中国证券投资基金业协会', '基金 ETF 定义 中国证券投资基金业协会']
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
      '.dfb-trace{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:8px 0 6px;font-size:12px;}' +
      '.dfb-links{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-left:auto;}' +
      '.dfb-source{color:var(--muted,#475569);font-weight:500;}' +
      '.dfb-source-infer{color:#b45309;background:#fff7e6;border:1px solid #ffd591;border-radius:6px;padding:1px 7px;font-weight:600;}' +
      '.dfb-ref{color:#7c3aed;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;padding:1px 7px;font-weight:500;}' +
      '.dfb-link{color:var(--primary,#2563eb);text-decoration:none;font-weight:600;}' +
      '.dfb-link:hover{text-decoration:underline;}' +
      '.dfb-link-search{color:#0e7490;text-decoration:none;font-weight:600;}' +
      '.dfb-link-search:hover{text-decoration:underline;}' +
      '.dfb-link-home{color:#94a3b8;text-decoration:none;font-size:11px;}' +
      '.dfb-link-home:hover{text-decoration:underline;}' +
      '.dfb-missing{color:#d93025 !important;background:#fff1f0;border:1px solid #ffccc7;border-radius:6px;padding:1px 7px;font-weight:600;}' +
      '.dfb-meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted,#94a3b8);}' +
      '.dfb-tag{padding:2px 8px;border-radius:6px;background:var(--tag-bg,#eff6ff);color:var(--primary,#2563eb);font-weight:500;}' +
      '.dfb-date{color:var(--muted,#94a3b8);}' +
      '.dfb-empty{padding:18px;text-align:center;color:var(--muted,#94a3b8);font-size:13px;}' +
      '.dfb-trace-bar{position:relative;z-index:50;max-width:1100px;margin:10px auto;padding:10px 16px;border-radius:10px;font-size:13px;line-height:1.7;border:1px solid;}' +
      '.dfb-trace-bar.ok{background:#f0fff4;border-color:#b7eb8f;color:#135200;}' +
      '.dfb-trace-bar.warn{background:#fffbe6;border-color:#ffe58f;color:#874d00;}' +
      '.dfb-trace-bar code{background:rgba(0,0,0,.06);padding:1px 5px;border-radius:4px;font-size:12px;}' +
      '.dfb-diag{position:relative;z-index:99999;padding:12px 14px;margin:10px;font:12px/1.7 monospace;' +
      'white-space:pre-wrap;word-break:break-all;border-radius:8px;border:2px solid;}' +
      '.dfb-diag.red{background:#fff3f3;border-color:#e33;color:#222;}';
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
  function SRC(o) { return getVal(o, ['source', 'source_name', 'from', 'media', 'site', 'publisher', '来源', '出处', '媒体']); }
  function C(o)   { return getVal(o, ['category', 'type', 'tag', 'section', 'cat', 'channel', '分类', '标签', '类别']); }
  function hint(o){ return getVal(o, ['category', 'name', 'type', 'label', 'tag', 'section', 'channel', '分类', '名称', '类别']); }
  function norm(s){ return String(s == null ? '' : s).toLowerCase().replace(/[-_\s]/g, ''); }
  function low(s){ return String(s == null ? '' : s).toLowerCase(); }

  function isHomeUrl(u) {
    if (!u) return false;
    try {
      var a = new URL(u, document.baseURI || location.href);
      var p = a.pathname.replace(/\/(index\.(html?|php|aspx?))$/i, '');
      return p === '' || p === '/';
    } catch (e) { return false; }
  }
  function searchUrl(q) { return 'https://www.baidu.com/s?wd=' + encodeURIComponent(String(q || '').trim()); }

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
      var l = norm(c);
      for (var a = 0; a < CAT.length; a++) {
        var kw = CAT[a][1];
        for (var b = 0; b < kw.length; b++) {
          var k = norm(kw[b]); if (!k) continue;
          if (l.indexOf(k) > -1 || k.indexOf(l) > -1) return CAT[a][0];
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
      if (isContainer) { for (var c = 0; c < node.length; c++) collect(node[c], hint(node[c]) || pathKey); return; }
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

  // ---------- 溯源信息(纯函数, 显示与统计共用, 保证一致) ----------
  function inferSource(it, cid) {
    var hay = low(T(it)) + ' ' + low(C(it));
    for (var i = 0; i < SRC_RULES.length; i++) {
      var kws = SRC_RULES[i][0];
      for (var j = 0; j < kws.length; j++) if (hay.indexOf(low(kws[j])) > -1) return SRC_RULES[i][1];
    }
    return CAT_SRC[cid] || null;
  }
  function matchKnow(it) {
    var hay = low(T(it)) + ' ' + low(S(it));
    for (var i = 0; i < KNOW_REF.length; i++) {
      var kws = KNOW_REF[i][0];
      for (var j = 0; j < kws.length; j++) if (hay.indexOf(low(kws[j])) > -1) return { ref: KNOW_REF[i][1], hint: KNOW_REF[i][2] };
    }
    return null;
  }
  function getSrcInfo(it, cid) {
    var exact = SRC(it);
    if (exact) return { type: 'exact', name: exact };
    var inf = inferSource(it, cid);
    if (inf) return { type: 'infer', name: inf };
    return { type: 'missing', name: '' };
  }
  function getLinkInfo(it, cid) {
    var u = U(it), home = u && isHomeUrl(u), precise = u && !home;
    var ref = (cid === 'knowledge-content') ? matchKnow(it) : null;
    if (precise) return { type: 'exact', url: u, ref: ref ? ref.ref : '', homeUrl: '' };
    var si = getSrcInfo(it, cid);
    var cleanName = (si.type === 'exact') ? si.name : '';   // 仅确证来源名才进检索词, 推断名不污染
    var q = ref ? ref.hint : ((cleanName ? cleanName + ' ' : '') + T(it));
    return { type: 'search', url: searchUrl(q), ref: ref ? ref.ref : '', homeUrl: home ? u : '' };
  }

  // ---------- 卡片 ----------
  function card(it, cid) {
    var t = T(it); if (!t) return '';
    var li = getLinkInfo(it, cid);
    var si = getSrcInfo(it, cid);
    var sum = S(it), d = D(it), cat = C(it);

    var titleHtml = (li.type === 'exact')
      ? '<a class="dfb-title-link" href="' + esc(li.url) + '" target="_blank" rel="noopener">' + esc(t) + '</a>'
      : '<h3 class="dfb-title">' + esc(t) + '</h3>';

    var srcHtml;
    if (si.type === 'exact') srcHtml = '<span class="dfb-source">📰 来源：' + esc(si.name) + '</span>';
    else if (si.type === 'infer') srcHtml = '<span class="dfb-source-infer" title="系统按内容关键词推断的一手权威发布方，非逐条人工核实；引用前请在原文确认">📰 推断来源：' + esc(si.name) + '（建议核实）</span>';
    else srcHtml = '<span class="dfb-missing" title="无法判定来源，请在数据中补全 source 字段">📰 来源：无法判定 ⚠️</span>';

    var links = [];
    if (cid === 'knowledge-content' && li.ref) {
      links.push('<span class="dfb-ref" title="该知识点的权威参考出处（事实性来源，可独立核验），引用时请注明">📚 参考：' + esc(li.ref) + '</span>');
    }
    if (li.type === 'exact') {
      links.push('<a class="dfb-link" href="' + esc(li.url) + '" target="_blank" rel="noopener" title="数据提供的精确原文链接">🔗 查看原文 ↗</a>');
    } else {
      links.push('<a class="dfb-link-search" href="' + esc(li.url) + '" target="_blank" rel="noopener" title="未提供精确原文链接，已用“权威源头＋标题”生成检索入口，点击可一步定位原文">🔍 检索原文 ↗</a>');
      if (li.homeUrl) links.push('<a class="dfb-link-home" href="' + esc(li.homeUrl) + '" target="_blank" rel="noopener" title="数据中提供的链接仅为站点首页，非该条精确原文">· 站点首页↗</a>');
    }

    var meta = '<div class="dfb-meta">' +
      (cat ? '<span class="dfb-tag">' + esc(cat) + '</span>' : '<span></span>') +
      '<span class="dfb-date">' + esc(d) + '</span></div>';

    var inner = titleHtml + (sum ? '<p class="dfb-summary">' + esc(sum) + '</p>' : '') +
      '<div class="dfb-trace">' + srcHtml + '<span class="dfb-links">' + links.join('') + '</span></div>' + meta;
    return '<div class="dfb-card">' + inner + '</div>';
  }

  // ---------- 溯源统计 ----------
  function traceReport() {
    var n = allNews.length, se = 0, si = 0, sm = 0, le = 0, ls = 0;
    for (var i = 0; i < n; i++) {
      var s = getSrcInfo(allNews[i].it, allNews[i].cid);
      if (s.type === 'exact') se++; else if (s.type === 'infer') si++; else sm++;
      var l = getLinkInfo(allNews[i].it, allNews[i].cid);
      if (l.type === 'exact') le++; else ls++;
    }
    return { n: n, se: se, si: si, sm: sm, le: le, ls: ls };
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
    if (r.sm === 0 && r.si === 0 && r.le === r.n) {
      bar.className = 'dfb-trace-bar ok';
      bar.innerHTML = '✅ 数据溯源完整：全部 <b>' + r.n + '</b> 条均已填写确证来源与精确原文链接。';
    } else {
      bar.className = 'dfb-trace-bar warn';
      bar.innerHTML =
        '🔎 溯源状态（共 <b>' + r.n + '</b> 条）｜来源：确证 <b>' + r.se + '</b> · 推断 <b>' + r.si + '</b> · 缺失 <b>' + r.sm +
        '</b>｜链接：精确原文 <b>' + r.le + '</b> · 检索直达 <b>' + r.ls + '</b>。<br>' +
        '橙色“推断来源”与青色“检索原文”为<b>诚实兜底</b>：来源按内容映射到一手权威发布方，链接用“源头＋标题”一步定位原文，' +
        '知识角另附紫色“参考出处”（法条/教材/官方机构）。<b>系统不伪造任何精确原文 URL。</b><br>' +
        '若要全部转为绿标确证，请在 <code>data/news-data.json</code> 为每条补全真实 <code>source</code> 与<b>精确到该篇文章</b>的 <code>url</code>（抓取时直接写入即可）。';
    }
  }

  // ---------- 渲染 ----------
  function render(kw) {
    kw = (kw || '').toLowerCase();
    var tmp = {}; IDS.forEach(function (id) { tmp[id] = []; });
    var shown = 0;
    allNews.forEach(function (e) {
      if (kw) { var hay = (T(e.it) + ' ' + S(e.it) + ' ' + C(e.it)).toLowerCase(); if (hay.indexOf(kw) < 0) return; }
      tmp[e.cid || IDS[0]].push(e); shown++;
    });
    var total = 0;
    IDS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var list = tmp[id]; total += list.length;
      el.innerHTML = list.length ? list.map(function (e) { return card(e.it, id); }).join('') : '<div class="dfb-empty">暂无相关资讯</div>';
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
              var anchor = document.getElementById(CAT[i][0].replace('-news', '').replace('-content', ''));
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
          diag('red', '❌ 数据文件里没有可识别的新闻条目。\n\n【原始 JSON 前 800 字】\n' + rawText.slice(0, 800) +
            '\n\n【typeof】 ' + typeof json + '\n【顶层结构】 ' + topInfo(json));
        }
      })
      .catch(function (e) { diag('red', '❌ 加载失败: ' + e.message + '\n目标路径: ' + DATA_URL); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
