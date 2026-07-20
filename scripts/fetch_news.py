# -*- coding: utf-8 -*-
"""
财经日报 · 每日自动抓取器（纯标准库 · 零依赖 · 全容错 · 空抓保护）
主源: Google News RSS（按7主题搜中文，海外runner畅通；自带真实媒体名+可解码真实原文url）
备份: 直连 RSS（容错，挂了跳过）
知识角: 读 data/knowledge.json（独立维护，不每天抓）
输出: data/news-data.json  schema = {title,summary,date,category,source,url}  与前端零改动兼容
运行: 在仓库根执行  python3 scripts/fetch_news.py
"""
import os, re, sys, json, base64, traceback
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

BJ = timezone(timedelta(hours=8))
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 仓库根
DATA_DIR = os.path.join(BASE, 'data')
OUT = os.path.join(DATA_DIR, 'news-data.json')
KNOW = os.path.join(DATA_DIR, 'knowledge.json')
PER_CAT = 12          # 每类最多保留条数
UA = 'Mozilla/5.0 (compatible; DailyFinanceBrief/1.0; +https://github.com/)'

# ---------- 主题查询表（Google News RSS）。增删主题只改这里。category 须是前端能识别的分类词 ----------
TOPICS = [
    ('时政',     '中国 时政 国务院 政策 中美 美联储'),
    ('国际贸易', '外贸 进出口 关税 商务部 海关 贸易 世贸'),
    ('跨境电商', '跨境电商 亚马逊 Temu SHEIN 出海 海外仓'),
    ('股市',     'A股 沪指 深指 创业板 美股 纳斯达克 股市'),
    ('债券',     '国债 债市 收益率 央行 降准 降息'),
    ('基金',     '基金 ETF 净值 公募 私募'),
]
# ---------- 备份直连 RSS（容错；失效就在日志看 FAIL，注释掉或换 url 即可，无需懂代码） ----------
BACKUP_RSS = [
    ('BBC中文',     '时政',     'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml'),
    ('德国之声中文', '国际贸易', 'https://rss.dw.com/xml/rss-chi-all'),
]
# ---------- 知识角默认值（当 data/knowledge.json 不存在时使用；标题含关键词以触发前端"紫参考"） ----------
DEFAULT_KNOWLEDGE = [
    {"title": "什么是301条款?", "summary": "绕开WTO，单方面对贸易伙伴加税，是美国单边主义典型工具。", "category": "知识"},
    {"title": "什么是关税?", "summary": "100元T恤加25%关税=售价约125元，成本最终转嫁给消费者或压缩卖家利润。", "category": "知识"},
    {"title": "什么是汇率?", "summary": "一国货币兑换另一国货币的比率，受利率、贸易、预期影响，波动牵动进出口与跨境资金。", "category": "知识"},
    {"title": "什么是CPI与通胀?", "summary": "CPI衡量一篮子消费品价格变化，持续上涨即通胀，侵蚀购买力，是央行货币政策核心锚。", "category": "知识"},
    {"title": "什么是GDP?", "summary": "一国一定时期内生产的全部最终产品和服务的市场价值，衡量经济规模与增速的核心指标。", "category": "知识"},
    {"title": "什么是国债与收益率?", "summary": "政府发行的债券；收益率与价格反向，被视为无风险利率基准，影响全市场定价。", "category": "知识"},
    {"title": "什么是ETF与基金净值?", "summary": "ETF是交易所交易的指数基金；净值是每份基金对应资产价值，是申赎与估值基准。", "category": "知识"},
    {"title": "什么是贸易战/关税战?", "summary": "国家间以加征关税、设限为手段的经贸对抗，扰乱供应链并推高全球成本。", "category": "知识"},
]

# ===================== 工具函数 =====================
def log(*a):
    print(*a, flush=True)

def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def text_of(el):
    return unescape(''.join(el.itertext())).strip() if el is not None else ''

def ln(tag):
    return tag.split('}')[-1] if '}' in tag else tag

def strip_html(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    s = unescape(s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s[:160]

def parse_dt(s):
    if not s:
        return None
    try:
        return parsedate_to_datetime(s)
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None

def bj_date(dt):
    if dt is None:
        return None
    try:
        return dt.astimezone(BJ).date()
    except Exception:
        return dt.date()

_GNEWS_ART = re.compile(r'articles/([^?/]+)')
_URL_BYTES = re.compile(rb'https?://[A-Za-z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]+')
def decode_gnews(url):
    """把 Google News 的跳转 id 解码成真实原文 url；解不出返回 '' （让前端走检索直达，大陆可开）"""
    if not url or 'news.google.com' not in url:
        return url
    m = _GNEWS_ART.search(url)
    if not m:
        return ''
    s = m.group(1) + '=' * (-len(m.group(1)) % 4)
    try:
        raw = base64.urlsafe_b64decode(s.encode())
    except Exception:
        return ''
    for u in _URL_BYTES.findall(raw):
        us = u.decode('latin1')
        if 'news.google.com' not in us:
            return us
    return ''

def split_gnews_title(t):
    """Google News 标题形如 '真实标题 - 媒体名'，拆出来源媒体"""
    if ' - ' in t:
        a, b = t.rsplit(' - ', 1)
        return a.strip(), b.strip()
    return t.strip(), ''

def norm(s):
    return re.sub(r'\s+', '', (s or '').lower())

# ===================== 解析 feed =====================
def parse_feed(data):
    """RSS2.0 / Atom 通吃，返回 [{title,link,desc,pub}]"""
    root = ET.fromstring(data)
    out = []
    for el in root.iter():
        if ln(el.tag) not in ('item', 'entry'):
            continue
        title = link = desc = pub = None
        for ch in el:
            n = ln(ch.tag)
            if n == 'title':
                title = text_of(ch)
            elif n == 'link':
                link = ch.get('href') or (ch.text or '').strip() or link
            elif n in ('description', 'summary', 'content'):
                desc = desc or text_of(ch)
            elif n in ('pubDate', 'published', 'updated', 'date'):
                pub = pub or text_of(ch)
        if title or link:
            out.append({'title': title or '', 'link': link or '', 'desc': desc or '', 'pub': pub})
    return out

# ===================== 抓取一个 Google News 主题 =====================
def fetch_topic(category, query, seen_t
