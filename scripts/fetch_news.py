# -*- coding: utf-8 -*-
"""
财经日报 · 每日自动抓取器
- 纯标准库(urllib/xml/base64/re/json)，零 pip 依赖 → Actions 里 python3 直接跑，少一个依赖少一个挂点
- 主源 Google News RSS(6主题)：免key、聚合国内权威媒体、自带媒体名(填source)、可解码真实原文url(填url)
- 备源 直连 RSS：容错，单源挂了 try/except 跳过，不影响其它
- 知识角：读 data/knowledge.json 合并(独立维护，不每天抓；不存在则用内置默认并自动创建)
- 空抓保护：新闻条目==0 或脚本异常 → 不写文件 → 网站保留上一版，绝不白屏
- 输出 data/news-data.json：扁平数组，每条 {title,summary,date,category,source,url}，前端零改动兼容
运行：仓库根执行  python3 scripts/fetch_news.py
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
PER_CAT = 10          # 每类最多保留条数，防止 json 无限膨胀
UA = 'Mozilla/5.0 (compatible; DailyFinanceBrief/1.0; +https://github.com/)'

# ---------- 主题查询表(Google News RSS)。增删主题只改这里。category 须是前端 CAT 表能识别的词 ----------
TOPICS = [
    ('时政',     '时政 OR 国务院 OR 政策 OR 中美 OR 美联储 OR 央行'),
    ('国际贸易', '外贸 OR 进出口 OR 关税 OR 贸易战 OR 商务部 OR 世贸'),
    ('跨境电商', '跨境电商 OR 亚马逊 OR Temu OR SHEIN OR 出海 OR 海外仓'),
    ('股市',     'A股 OR 沪指 OR 深指 OR 创业板 OR 美股 OR 纳斯达克 OR 股市'),
    ('债券',     '国债 OR 债市 OR 收益率 OR 降准 OR 降息 OR 地方债'),
    ('基金',     '基金 OR ETF OR 净值 OR 公募 OR 私募'),
]
# ---------- 备份直连 RSS(容错；失效就在日志看 FAIL，注释掉或换 url 即可，无需懂代码) ----------
BACKUP_RSS = [
    ('BBC中文',      '时政',     'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml'),
    ('德国之声中文',  '国际贸易', 'https://rss.dw.com/xml/rss-chi-all'),
]
# ---------- 知识角默认值(当 data/knowledge.json 不存在时使用；标题含关键词以触发前端"紫参考") ----------
DEFAULT_KNOWLEDGE = [
    {"title": "什么是301条款?", "summary": "绕开WTO，单方面对贸易伙伴加税，是美国单边主义典型工具。", "category": "知识角"},
    {"title": "什么是关税?", "summary": "100元T恤加25%关税=售价约125元，成本最终转嫁给消费者或压缩卖家利润。", "category": "知识角"},
    {"title": "什么是汇率?", "summary": "一国货币兑换另一国货币的比率，受利率、贸易、预期影响，波动牵动进出口与跨境资金。", "category": "知识角"},
    {"title": "什么是CPI与通胀?", "summary": "CPI衡量一篮子消费品价格变化，持续上涨即通胀，侵蚀购买力，是央行货币政策核心锚。", "category": "知识角"},
    {"title": "什么是GDP?", "summary": "一国一定时期内生产的全部最终产品和服务的市场价值，衡量经济规模与增速的核心指标。", "category": "知识角"},
    {"title": "什么是国债与收益率?", "summary": "政府发行的债券；收益率与价格反向，被视为无风险利率基准，影响全市场定价。", "category": "知识角"},
    {"title": "什么是ETF与基金净值?", "summary": "ETF是交易所交易的指数基金；净值是每份基金对应资产价值，是申赎与估值基准。", "category": "知识角"},
    {"title": "什么是贸易战/关税战?", "summary": "国家间以加征关税、设限为手段的经贸对抗，扰乱供应链并推高全球成本。", "category": "知识角"},
]

# ===================== 工具函数 =====================
def log(*a):
    print(*a, flush=True)

def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def text_of(el):
    return unescape(''.join(el.itertext())).strip() if el is not None else ''

def ln(tag):                       # 去掉 XML 命名空间，RSS2.0/Atom 通吃
    return tag.split('}')[-1] if '}' in tag else tag

def strip_html(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    s = unescape(s)
    return re.sub(r'\s+', ' ', s).strip()[:160]

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
    """把 Google News 的跳转 id 解码成真实原文 url；解不出返回 ''（让前端走检索直达，大陆可开）"""
    if not url or 'news.google.com' not in url:
        return url
    m = _GNEWS_ART.search(url)
    if not m:
        return ''
    s = m.group(1) + '=' * (-len(m.group(1)) % 4)     # 补 base64 padding
    try:
        raw = base64.urlsafe_b64decode(s.encode())
    except Exception:
        return ''
    for u in _URL_BYTES.findall(raw):
        us = u.decode('latin1')
        if 'news.google.com' not in us:               # 排除 google 自身的串
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

# ===================== 解析 feed(RSS2.0/Atom 通吃) =====================
def parse_feed(data):
    root = ET.fromstring(data)
    out = []
    for el in root.iter():
        if ln(el.tag) not in ('item', 'entry'):
            continue
        title = link = desc = pub = src = None
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
            elif n == 'source':
                src = text_of(ch)
        if title or link:
            out.append({'title': title or '', 'link': link or '', 'desc': desc or '', 'pub': pub, 'src': src or ''})
    return out

# ===================== 抓取一个 Google News 主题 =====================
def fetch_topic(category, query, seen_titles, window_dates):
    url = ('https://news.google.com/rss/search?q=' +
           urllib.request.quote(query) + '&hl=zh-CN&gl=CN&ceid=CN:zh-Hans')
    items = []
    try:
        data = fetch(url)
        feed = parse_feed(data)
    except Exception as e:
        log('   [FAIL] Google主题[%s]: %s' % (category, e))
        return items
    decoded_ok = 0
    for it in feed:
        title, media = split_gnews_title(it['title'])
        source = it['src'] or media                       # 优先 <source> 标签，否则标题后缀
        if not title or norm(title) in seen_titles:
            continue
        d = bj_date(parse_dt(it['pub']))
        if window_dates and d not in window_dates:        # 时效过滤：只要北京"昨天+今天"
            continue
        real_url = decode_gnews(it['link'])               # 解不出='' → 前端走检索直达
        if real_url:
            decoded_ok += 1
        items.append({
            'title': title,
            'summary': strip_html(it['desc']),
            'date': (d.isoformat() if d else datetime.now(BJ).strftime('%Y-%m-%d')),
            'category': category,
            'source': source,                              # 真实媒体名 → 前端黑字确证
            'url': real_url,                               # 真实原文 url → 前端蓝链；空则降级检索
        })
        seen_titles.add(norm(title))
    log('   [OK]  Google主题[%s]: 命中 %d 条, 解码原文url %d 条' % (category, len(items), decoded_ok))
    return items

# ===================== 抓取一个直连备份 RSS =====================
def fetch_backup(source_name, category, feed_url, seen_titles, window_dates):
    items = []
    try:
        data = fetch(feed_url)
        feed = parse_feed(data)
    except Exception as e:
        log('   [FAIL] 备份源[%s]: %s' % (source_name, e))
        return items
    for it in feed:
        title = it['title'].strip()
        if not title or norm(title) in seen_titles:
            continue
        d = bj_date(parse_dt(it['pub']))
        if window_dates and d not in window_dates:
            continue
        items.append({
            'title': title,
            'summary': strip_html(it['desc']),
            'date': (d.isoformat() if d else datetime.now(BJ).strftime('%Y-%m-%d')),
            'category': category,
            'source': source_name,
            'url': it['link'] if it['link'] and 'news.google.com' not in it['link'] else '',
        })
        seen_titles.add(norm(title))
    log('   [OK]  备份源[%s]: 命中 %d 条' % (source_name, len(items)))
    return items

# ===================== 知识角 =====================
def load_knowledge():
    if os.path.exists(KNOW):
        try:
            with open(KNOW, 'r', encoding='utf-8') as f:
                arr = json.load(f)
            if isinstance(arr, list):
                log('[知识角] 读取 data/knowledge.json: %d 条' % len(arr))
                return arr
        except Exception as e:
            log('[知识角] knowledge.json 解析失败，用内置默认: %s' % e)
    else:
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(KNOW, 'w', encoding='utf-8') as f:
                json.dump(DEFAULT_KNOWLEDGE, f, ensure_ascii=False, indent=2)
            log('[知识角] 未找到 knowledge.json，已用内置默认创建')
        except Exception as e:
            log('[知识角] 创建默认文件失败: %s' % e)
    return list(DEFAULT_KNOWLEDGE)

# ===================== 主流程 =====================
def main():
    log('==== 财经日报抓取开始 (北京时间 %s) ====' % datetime.now(BJ).strftime('%Y-%m-%d %H:%M:%S'))
    today = datetime.now(BJ).date()
    window = {today, today - timedelta(days=1)}           # 时效窗口：昨天+今天
    seen = set()
    news = []

    for category, query in TOPICS:
        news += fetch_topic(category, query, seen, window)
    for src_name, category, feed_url in BACKUP_RSS:
        news += fetch_backup(src_name, category, feed_url, seen, window)

    # 每类按日期倒序截断
    by_cat = {}
    for it in news:
        by_cat.setdefault(it['category'], []).append(it)
    trimmed = []
    for cat, lst in by_cat.items():
        lst.sort(key=lambda x: x['date'], reverse=True)
        trimmed += lst[:PER_CAT]
    trimmed.sort(key=lambda x: x['date'], reverse=True)

    knowledge = load_knowledge()
    log('---- 新闻 %d 条 + 知识角 %d 条 ----' % (len(trimmed), len(knowledge)))

    # ★ 空抓保护：新闻一条都没抓到 → 不写文件，网站保留上一版，绝不白屏
    if len(trimmed) == 0:
        log('⚠️ 空抓保护触发：本次未抓到任何新闻，不覆盖 news-data.json，网站保留上一版数据。')
        return 0

    out = trimmed + knowledge
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    log('✅ 已写出 %s，共 %d 条' % (OUT, len(out)))
    return len(trimmed)

if __name__ == '__main__':
    try:
        n = main()
        log('==== 抓取结束，新闻条数=%d ====' % n)
    except Exception as e:
        # 崩溃也不写文件 → 网站保留上一版
        log('❌ 抓取异常，未写文件，网站保留上一版：\n' + traceback.format_exc())
        sys.exit(1)
