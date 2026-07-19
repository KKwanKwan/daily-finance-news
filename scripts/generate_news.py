#!/usr/bin/env python3
import json, feedparser, requests
from datetime import datetime, timezone, timedelta
from bs4 import BeautifulSoup
from pathlib import Path

CST = timezone(timedelta(hours=8))
TODAY = datetime.now(CST).strftime("%Y-%m-%d")
OUT = Path("data/news-data.json")
ARCH_DIR = Path("data/archive")
ARCH_INDEX = ARCH_DIR / "index.json"

SOURCES = {
  "politics":[{"name":"新华社","url":"http://www.xinhuanet.com/politics/news_politics.xml"}],
  "trade":[{"name":"商务部","url":"http://www.mofcom.gov.cn/article/xwfb/rss.xml"},{"name":"Reuters","url":"https://feeds.reuters.com/reuters/businessNews"}],
  "ecommerce":[{"name":"雨果跨境","url":"https://rsshub.app/cifnews/latest"}],
  "stock":[{"name":"东方财富","url":"https://rsshub.app/eastmoney/report/stock"}],
  "bond":[{"name":"中国债券信息网","url":"https://rsshub.app/chinabond/notice"}],
  "fund":[{"name":"天天基金","url":"https://rsshub.app/eastmoney/fund"}]
}

KNOWLEDGE = [
  {"title":"什么是301条款？","intro":"美国《1974年贸易法》第301条，授权USTR单边调查加税。","content":"绕开WTO的单边主义工具。","tip":"外贸面试高频考点。"},
  {"title":"什么是关税？","intro":"对进口商品征收的税。","content":"成本最终转嫁消费者或压缩利润。","tip":"理解国际贸易的基础。"},
  {"title":"FBA vs FBM","intro":"亚马逊两种物流模式。","content":"FBA=亚马逊发货；FBM=自发货。","tip":"本质是成本vs控制权权衡。"},
  {"title":"股债跷跷板","intro":"股跌债涨，反之亦然。","content":"资产配置核心原理。","tip":"别把鸡蛋放一个篮子。"},
  {"title":"什么是ETF？","intro":"像股票一样买卖的一篮子指数基金。","content":"宽基ETF分散风险、费率低。","tip":"大学生定投入门首选。"},
  {"title":"Incoterms 贸易术语","intro":"界定买卖双方费用与风险划分。","content":"FOB/CIF/DDP 各有边界。","tip":"报价前先搞懂，否则亏运费关税。"},
  {"title":"什么是资产荒？","intro":"钱多但优质资产少。","content":"表现为债牛、资金追高股息与黄金。","tip":"看懂存款搬家与债牛并存。"}
]

def fetch(src):
    items=[]
    try:
        feed=feedparser.parse(src["url"], request_headers={"User-Agent":"DailyFinanceBrief/1.0"})
        for e in feed.entries[:8]:
            title=e.get('title','').strip()
            summary=BeautifulSoup(e.get('summary',''),'html.parser').get_text()[:200] if e.get('summary') else "点击查看详情"
            items.append({"title":title,"summary":summary,"source_name":src["name"],
                          "source_url":e.get('link',src["url"]),"date":TODAY})
    except Exception as ex:
        print(f"⚠️ {src['name']}: {ex}")
    return items

result = {"generated_at": datetime.now(CST).isoformat(), "date": TODAY}
total = 0
for cat, srcs in SOURCES.items():
    result[cat] = []
    for s in srcs:
        result[cat].extend(fetch(s))
    result[cat] = result[cat][:8]
    total += len(result[cat])

# 知识点：今日一个 + 全量池供"换一换"
idx = datetime.now(CST).timetuple().tm_yday % len(KNOWLEDGE)
result["knowledge"] = KNOWLEDGE[idx]
result["knowledge_pool"] = KNOWLEDGE

# 写今日
OUT.parent.mkdir(exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# 写归档
ARCH_DIR.mkdir(parents=True, exist_ok=True)
with open(ARCH_DIR / f"{TODAY}.json", 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# 更新归档索引
index = []
if ARCH_INDEX.exists():
    try:
        index = json.loads(ARCH_INDEX.read_text(encoding='utf-8'))
    except Exception:
        index = []
index = [x for x in index if x.get('date') != TODAY]
index.append({"date": TODAY, "url": f"data/archive/{TODAY}.json", "total": total})
index.sort(key=lambda x: x['date'], reverse=True)
with open(ARCH_INDEX, 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print(f"✅ 已生成 {OUT} 与归档 {TODAY}.json | 共 {total} 条")
