/* ===== 每日财经资讯 · 交互核心 ===== */
const $ = s => document.querySelector(s);
const SECTIONS = ['politics','trade','ecommerce','stock','bond','fund'];
const GRID = ['politics','stock','fund'];
let CURRENT = null;        // 当前数据
let KNOWLEDGE_POOL = [];   // 知识点池
let todayLabel = '';

document.addEventListener('DOMContentLoaded', init);

function init(){
  bindTheme();
  bindTabs();
  bindSearch();
  bindBackTop();
  bindArchive();
  bindContainerClick();   // 事件委托：整卡跳原文
  loadToday();
}

/* ---------- 加载今日 ---------- */
function loadToday(){
  fetch('data/news-data.json?t=' + Date.now())
    .then(r => r.json())
    .then(data => {
      todayLabel = fmtDate(data.date || data.generated_at);
      render(data, todayLabel, false);
    })
    .catch(() => render(getDefault(), fmtDate(new Date()), false));
}

/* ---------- 渲染 ---------- */
function render(data, label, isArchive){
  CURRENT = data;
  KNOWLEDGE_POOL = Array.isArray(data.knowledge_pool) ? data.knowledge_pool : [];

  // 标题
  $('#heroTitle').textContent = label + ' 财经日报';
  const sub = $('#heroSub');
  if(isArchive){ sub.hidden = false; sub.textContent = '📅 往期存档 · 点击右上「往期」切换日期'; }
  else { sub.hidden = true; }

  // 各板块
  SECTIONS.forEach(k => {
    const el = $('#' + k + '-news');
    const list = data[k] || [];
    if(!list.length){ el.innerHTML = '<div class="loading">暂无数据</div>'; return; }
    el.innerHTML = list.map(cardHTML).join('');
  });

  // 知识角
  renderKnowledge(data.knowledge);
  $('#knowledgeShuffle').hidden = KNOWLEDGE_POOL.length < 2;

  // 统计速览
  renderStats(data);

  // 渐入动画
  observeReveals();
}

function cardHTML(n){
  const domain = safeDomain(n.source_url);
  const badgeColor = strColor(n.source_name || domain);
  const initial = (n.source_name || '?').trim().charAt(0);
  const tags = Array.isArray(n.tags) && n.tags.length
    ? '<div class="chips">' + n.tags.map(t => `<span class="chip">#${esc(t)}</span>`).join('') + '</div>' : '';
  const date = n.date ? ` · ${n.date}` : '';
  return `<article class="news-card reveal" data-url="${esc(n.source_url)}">
    <h3>${esc(n.title)}</h3>
    <p>${esc(n.summary)}</p>
    ${tags}
    <div class="news-foot">
      <span class="source">
        <span class="badge" style="background:${badgeColor}">${esc(initial)}</span>
        <a href="${esc(n.source_url)}" target="_blank" rel="noopener">${esc(n.source_name)}</a>${esc(date)}
      </span>
      <a class="go-link" href="${esc(n.source_url)}" target="_blank" rel="noopener">查看原文 ↗</a>
    </div>
  </article>`;
}

function renderKnowledge(k){
  const el = $('#knowledge-content');
  if(!k){ el.innerHTML = '<div class="loading">暂无知识点</div>'; return; }
  let table = '';
  if(k.table && k.table.rows){
    table = '<table class="k-table"><tr>' + k.table.headers.map(h=>`<th>${esc(h)}</th>`).join('') + '</tr>'
      + k.table.rows.map(r=>'<tr>'+r.map(c=>`<td>${esc(c)}</td>`).join('')+'</tr>').join('') + '</table>';
  }
  el.innerHTML = `<h3>💡 ${esc(k.title)}</h3>
    <p class="k-intro">${esc(k.intro)}</p>
    <div class="k-box">${esc(k.content||'')}</div>
    ${table}
    <div class="k-tip"><strong>🎓 给大学生的话：</strong>${esc(k.tip||'')}</div>`;
}

function renderStats(data){
  const total = SECTIONS.reduce((s,k)=> s + (data[k]?data[k].length:0), 0);
  const srcSet = new Set();
  SECTIONS.forEach(k=> (data[k]||[]).forEach(n=> n.source_name && srcSet.add(n.source_name)));
  $('#statsBar').innerHTML =
    `<span class="stat"><b>${total}</b>条资讯</span>` +
    `<span class="stat"><b>${srcSet.size}</b>家来源</span>` +
    `<span class="stat"><b>${SECTIONS.length}</b>大板块</span>` +
    `<span class="stat"><b>${KNOWLEDGE_POOL.length || (data.knowledge?1:0)}</b>个知识点</span>`;
}

/* ---------- 整卡点击委托 ---------- */
function bindContainerClick(){
  $('.container').addEventListener('click', e => {
    if(e.target.closest('a')) return;            // 链接自己跳，不拦截
    const card = e.target.closest('.news-card,.news-item');
    if(card && card.dataset.url) window.open(card.dataset.url, '_blank');
  });
}

/* ---------- 搜索过滤 ---------- */
function bindSearch(){
  $('#searchInput').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.news-card,.news-item').forEach(card => {
      const txt = card.textContent.toLowerCase();
      const hit = !q || txt.includes(q);
      card.style.display = hit ? '' : 'none';
      if(hit) visible++;
    });
    $('#noResult').hidden = !(q && visible === 0);
  });
}

/* ---------- Tab 导航 + 滚动高亮 ---------- */
function bindTabs(){
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    const target = t.dataset.target;
    if(target === 'top'){ window.scrollTo({top:0,behavior:'smooth'}); return; }
    const sec = document.getElementById(target);
    if(sec) sec.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  // 滚动高亮
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if(en.isIntersecting){
        tabs.forEach(t => t.classList.toggle('active', t.dataset.target === en.target.id));
      }
    });
  }, {rootMargin:'-45% 0px -50% 0px'});
  SECTIONS.concat(['knowledge']).forEach(id => { const s=$('#'+id); if(s) obs.observe(s); });
}

/* ---------- 主题切换 ---------- */
function bindTheme(){
  const btn = $('#themeToggle');
  const saved = localStorage.getItem('dfb-theme');
  if(saved === 'dark'){ document.body.classList.add('dark'); btn.textContent='☀️'; }
  btn.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    btn.textContent = dark ? '☀️' : '🌙';
    localStorage.setItem('dfb-theme', dark ? 'dark' : 'light');
  });
}

/* ---------- 返回顶部 ---------- */
function bindBackTop(){
  const btn = $('#backTop');
  window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 400));
  btn.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
}

/* ---------- 知识换一换 ---------- */
$('#knowledgeShuffle')?.addEventListener('click', () => {
  if(KNOWLEDGE_POOL.length < 2) return;
  const cur = $('#knowledge-content h3')?.textContent || '';
  let pool = KNOWLEDGE_POOL.filter(k => ('💡 '+k.title) !== cur);
  if(!pool.length) pool = KNOWLEDGE_POOL;
  renderKnowledge(pool[Math.floor(Math.random()*pool.length)]);
});

/* ---------- 往期归档 ---------- */
function bindArchive(){
  $('#archiveBtn').addEventListener('click', openArchive);
  $('#archiveModal').addEventListener('click', e => { if(e.target.hasAttribute('data-close')) closeArchive(); });
}
function openArchive(){
  $('#archiveModal').hidden = false;
  $('#archiveList').innerHTML = '<div class="loading">加载中…</div>';
  fetch('data/archive/index.json?t=' + Date.now())
    .then(r => { if(!r.ok) throw 0; return r.json(); })
    .then(list => {
      if(!Array.isArray(list) || !list.length) throw 0;
      // 置顶"今日"
      let html = `<div class="archive-item today" data-today="1">
        <span class="d">📌 今天（最新）</span><span class="c">点击查看 →</span></div>`;
      html += list.sort((a,b)=> b.date.localeCompare(a.date)).map(it =>
        `<div class="archive-item" data-url="${esc(it.url)}" data-date="${esc(it.date)}">
          <span class="d">🗓️ ${esc(it.date)}</span>
          <span class="c">${it.total!=null?it.total+' 条':'查看'} →</span></div>`).join('');
      $('#archiveList').innerHTML = html;
      $('#archiveList').querySelectorAll('.archive-item').forEach(el => {
        el.addEventListener('click', () => {
          if(el.dataset.today){ closeArchive(); loadToday(); return; }
          loadArchive(el.dataset.url, el.dataset.date);
        });
      });
    })
    .catch(() => {
      $('#archiveList').innerHTML = `<div class="archive-empty">
        🗓️ 暂无往期记录<br>自动化任务运行后，将在此自动归档每日资讯<br>
        <small>（更新 generate_news.py 并运行一次 Actions 即可生成）</small></div>`;
    });
}
function loadArchive(url, date){
  $('#archiveList').innerHTML = '<div class="loading">加载中…</div>';
  fetch(url + '?t=' + Date.now()).then(r=>r.json()).then(data => {
    closeArchive();
    render(data, fmtDate(date), true);
    window.scrollTo({top:0,behavior:'smooth'});
  }).catch(()=>{ $('#archiveList').innerHTML = '<div class="archive-empty">😵 加载失败，请重试</div>'; });
}
function closeArchive(){ $('#archiveModal').hidden = true; }

/* ---------- 渐入动画 ---------- */
function observeReveals(){
  const obs = new IntersectionObserver((ents,o)=>{
    ents.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); o.unobserve(en.target);} });
  },{threshold:.12});
  document.querySelectorAll('.reveal:not(.in)').forEach(el=>obs.observe(el));
}

/* ---------- 工具 ---------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeDomain(u){ try{ return new URL(u).hostname.replace('www.',''); }catch(e){ return ''; } }
function strColor(s){ let h=0; for(let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h); return `hsl(${Math.abs(h)%360},55%,48%)`; }
function fmtDate(d){
  if(!d) return '';
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d+'T00:00:00') : new Date(d);
  if(isNaN(dt)) return String(d).slice(0,10);
  return dt.getFullYear()+'年'+(dt.getMonth()+1)+'月'+dt.getDate()+'日';
}

/* ---------- 兜底数据（无 json 时也能显示） ---------- */
function getDefault(){
  return {politics:[{title:"示例：国务院发布经济新政",summary:"部署自动化后将抓取真实新闻",source_name:"新华社",source_url:"https://www.xinhuanet.com"}],
  trade:[{title:"示例：中美贸易最新进展",summary:"每条新闻均标注可溯源链接",source_name:"商务部",source_url:"http://www.mofcom.gov.cn"}],
  ecommerce:[{title:"示例：亚马逊新规解读",summary:"聚焦跨境电商动态",source_name:"雨果跨境",source_url:"https://www.cifnews.com"}],
  stock:[{title:"示例：A股行情综述",summary:"自动抓取沪深指数",source_name:"东方财富",source_url:"https://www.eastmoney.com"}],
  bond:[{title:"示例：国债收益率走势",summary:"跟踪债券核心指标",source_name:"中国债券信息网",source_url:"https://www.chinabond.com.cn"}],
  fund:[{title:"示例：基金市场动态",summary:"ETF资金流向等",source_name:"天天基金",source_url:"https://fund.eastmoney.com"}],
  knowledge:{title:"什么是跨境电商？",intro:"分属不同关境的交易主体通过电商平台达成交易。",content:"你在亚马逊把中国商品卖给美国消费者，就是跨境电商。",tip:"2025年中国跨境电商进出口额超2.6万亿元。"}};
}
