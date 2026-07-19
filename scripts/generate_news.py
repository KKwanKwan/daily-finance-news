#!/usr/bin/env python3
import json,feedparser,requests
from datetime import datetime,timezone,timedelta
from bs4 import BeautifulSoup
from pathlib import Path

CST=timezone(timedelta(hours=8))
OUT=Path("data/news-data.json")
SOURCES={
  "politics":[{"name":"新华社","url":"http://www.xinhuanet.com/politics/news_politics.xml"}],
  "trade":[{"name":"商务部","url":"http://www.mofcom.gov.cn/article/xwfb/rss.xml"},{"name":"Reuters","url":"https://feeds.reuters.com/reuters/businessNews"}],
  "ecommerce":[{"name":"雨果跨境","url":"https://rsshub.app/cifnews/latest"}],
  "stock":[{"name":"东方财富","url":"https://rsshub.app/eastmoney/report/stock"}],
  "bond":[{"name":"中国债券信息网","url":"https://rsshub.app/chinabond/notice"}],
  "fund":[{"name":"天天基金","url":"https://rsshub.app/eastmoney/fund"}]
}
KNOWLEDGE=[
  {"title":"什么是关税？","intro":"关税是进口商品征收的税，直接影响消费者价格。","content":"100元T恤加25%关税=售价125元","tip":"理解关税是理解国际贸易的基础。"},
  {"title":"FBA vs FBM","intro":"亚马逊两种物流模式。","content":"FBA=亚马逊发货；FBM=自己发货。","tip":"2026年欧盟FBM新规要求更严格清关。"},
  {"title":"股债跷跷板","intro":"股市跌→资金涌入债市→债市涨。","content":"资产配置的核心原理。","tip":"不要把所有鸡蛋放一个篮子里。"}
]

def fetch(src):
    items=[]
    try:
        feed=feedparser.parse(src["url"],request_headers={"User-Agent":"DailyFinanceBrief/1.0"})
        for e in feed.entries[:8]:
            title=e.get('title','').strip()
            summary=BeautifulSoup(e.get('summary',''),'html.parser').get_text()[:200] if e.get('summary') else "点击查看详情"
            items.append({"title":title,"summary":summary,"source_name":src["name"],"source_url":e.get('link',src["url"]),"date":datetime.now(CST).strftime("%Y-%m-%d")})
    except Exception as ex: print(f"⚠️ {src['name']}: {ex}")
    return items

result={}
for cat,srcs in SOURCES.items():
    result[cat]=[]
    for s in srcs: result[cat].extend(fetch(s))
    result[cat]=result[cat][:8]

result["knowledge"]=KNOWLEDGE[datetime.now(CST).timetuple().tm_yday%len(KNOWLEDGE)]
OUT.parent.mkdir(exist_ok=True)
with open(OUT,'w',encoding='utf-8') as f:
    json.dump({"generated_at":datetime.now(CST).isoformat(),**result},f,ensure_ascii=False,indent=2)
print(f"✅ 已生成 {OUT} | {len(result)} 个模块")
