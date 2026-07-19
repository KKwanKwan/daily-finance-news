document.addEventListener('DOMContentLoaded',()=>{
  const d=new Date();
  document.querySelector('.hero h1').textContent=d.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})+' 财经日报';
  fetch('data/news-data.json?t='+Date.now()).then(r=>r.json()).then(render).catch(()=>render(getDefault()));
});
function render(data){
  ['politics','stock','fund'].forEach(k=>{
    const el=document.getElementById(k+'-news');
    if(data[k]) el.innerHTML=data[k].map(n=>`<article class="news-card"><h3>${n.title}</h3><p>${n.summary}</p><div class="news-source">📎 <a href="${n.source_url}" target="_blank">${n.source_name}</a></div></article>`).join('');
  });
  ['trade','ecommerce','bond'].forEach(k=>{
    const el=document.getElementById(k+'-news');
    if(data[k]) el.innerHTML=data[k].map(n=>`<article class="news-item"><h3>${n.title}</h3><p>${n.summary}</p><div class="news-source">📎 <a href="${n.source_url}" target="_blank">${n.source_name}</a></div></article>`).join('');
  });
  if(data.knowledge){
    const k=data.knowledge;
    document.getElementById('knowledge-content').innerHTML=`<h3>💡 ${k.title}</h3><p>${k.intro}</p><div style="background:#f0f7ff;padding:16px;border-radius:8px;margin:12px 0;border-left:4px solid #0071e3">${k.content||''}</div><p><strong>🎓 给大学生的话：</strong>${k.tip||''}</p>`;
  }
}
function getDefault(){return{politics:[{title:"示例：国务院发布经济新政",summary:"部署后自动抓取真实新闻",source_name:"新华社",source_url:"https://www.xinhuanet.com"}],trade:[{title:"示例：中美贸易最新进展",summary:"每条新闻均标注可溯源链接",source_name:"商务部",source_url:"http://www.mofcom.gov.cn"}],ecommerce:[{title:"示例：亚马逊新规解读",summary:"聚焦跨境电商动态",source_name:"雨果跨境",source_url:"https://www.cifnews.com"}],stock:[{title:"示例：A股行情综述",summary:"自动抓取沪深指数",source_name:"东方财富",source_url:"https://www.eastmoney.com"}],bond:[{title:"示例：国债收益率走势",summary:"跟踪债券核心指标",source_name:"中国债券信息网",source_url:"https://www.chinabond.com.cn"}],fund:[{title:"示例：基金市场动态",summary:"ETF资金流向等",source_name:"天天基金",source_url:"https://fund.eastmoney.com"}],knowledge:{title:"什么是跨境电商？",intro:"分属不同关境的交易主体通过电商平台达成交易。",content:"你在亚马逊把中国商品卖给美国消费者，就是跨境电商。",tip:"2025年中国跨境电商进出口额超2.6万亿元，是增长最快的行业之一。"}}}