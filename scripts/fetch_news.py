# -*- coding: utf-8 -*-
"""
财经日报 · 每日自动抓取器（适配现有 news-data.json 嵌套结构版）
输出结构 = 现有 json 同构: {generated_at, dates, politics:[], trade:[], ecommerce:[],
            stock:[], bond:[], fund:[], knowledge:[]}
每条字段 = 现有 json 同构: {title, summary, source_name, source_url, date, tags}
- source_name: 真实媒体名(Google RSS 自带) → 前端黑字确证(需 main.js 已加 'source_name')
- source_url : 解码后的真实文章 url(非首页) → 前端蓝链精确原文; 解不出='' → 前端检索直达
- knowledge  : 继承现有 json 的知识角, 不每天抓, 绝不丢
- 空抓保护   : 6 类新闻全空 → 不写文件 → 网站保留上一版
运行: 仓库根  python3 scripts/fetch_news.py
"""
import os, re, sys, json, base64, traceback
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

BJ = timezone(timedelta(hours=8))
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, 'data')
OUT = os.path.join(DATA_DIR, 'news-data.json')
KNOW = os.path.join(DATA_DIR, 'knowledge.json')
PER_CAT = 8           # 每类最多条数
WINDOW_DAYS = 3       # 时效窗口=近3天(对照现有json的date分布反推, 兼顾不空抓)
UA = 'Mozilla/5.0 (compatible; DailyFinanceBrief/1.0; +https://github.com/)'

# 主题: (前端分类中文标签, Google 查询词, 输出到 json 的英文键名)
TOPICS = [
    ('时政',     '时政 OR 国务院 OR 政策 OR 中美 OR 美联储 OR 央行',     'politics'),
    ('国际贸易', '外贸 OR 进出口 OR 关税 OR 贸易战 OR 商务部 OR 世贸',     'trade'),
    ('跨境电商', '跨境电商 OR 亚马逊 OR Temu OR SHEIN OR 出海 OR 海外仓',  'ecommerce'),
    ('股市',     'A股 OR 沪指 OR 深指 OR 创业板 OR 美股 OR 纳斯达克 OR 股市', 'stock'),
    ('债券',     '国债 OR 债市 OR 收益率 OR 降准 OR 降息 OR 地方债',       'bond'),
    ('基金',     '基金 OR ETF OR 净值 OR 公募 OR 私募',                  'fund'),
]
BACKUP_RSS = [
    ('BBC中文',     '时政',     'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml', 'politics'),
    ('德国之声中文', '国际贸易', 'https://rss.dw.com/xml/rss-chi-all',            'trade'),
]
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

# ===================== 工具 =====================
def log(*a): print(*a, flush=True)
def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': UA,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()
def text_of(el): return unescape(''.join(el.itertext())).strip() if el is not None else ''
def ln(tag): return tag.split('}')[-1] if '}' in tag else tag
def strip_html(s):
    s = re.sub(r'<[^>]+>', ' ', s or ''); s = unescape(s)
    return re.sub(r'\s+', ' ', s).strip()[:160]
def parse_dt(s):
    if not s: return None
    try: return parsedate_to_datetime(s)
    except Exception: pass
    try:
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception: return None
def bj_date(dt):
    if dt is None: return None
    try: return dt.astimezone(BJ).date()
    except Exception: return dt.date()
def norm(s): return re.sub(r'\s+', '', (s or '').lower())

_GNEWS_ART = re.compile(r'articles/([^?/]+)')
_URL_BYTES = re.compile(rb'https?://[A-Za-z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]+')
def decode_gnews(url):
    """Google 跳转 id → 真实文章 url; 解不出返回 '' (前端走检索直达)"""
    if not url or 'news.google.com' not in url: return url
    m = _GNEWS_ART.search(url)
    if not m: return ''
    s = m.group(1) + '=' * (-len(m.group(1)) % 4)
    try: raw = base64.urlsafe_b64decode(s.encode())
    except Exception: return ''
    for u in _URL_BYTES.findall(raw):
        us = u.decode('latin1')
        if 'news.google.com' not in us: return us
    return ''
def split_gnews_title(t):
    if ' - ' in t:
        a, b = t.rsplit(' - ', 1); return a.strip(), b.strip()
    return t.strip(), ''

def parse_feed(data):
    root = ET.fromstring(data); out = []
    for el in root.iter():
        if ln(el.tag) not in ('item', 'entry'): continue
        title = link = desc = pub = src = None
        for ch in el:
            n = ln(ch.tag)
            if n == 'title': title = text_of(ch)
            elif n == 'link': link = ch.get('href') or (ch.text or '').strip() or link
            elif n in ('description', 'summary', 'content'): desc = desc or text_of(ch)
            elif n in ('pubDate', 'published', 'updated', 'date'): pub = pub or text_of(ch)
            elif n == 'source': src = text_of(ch)
        if title or link:
            out.append({'title': title or '', 'link': link or '', 'desc': desc or '', 'pub': pub, 'src': src or ''})
    return out

def fetch_topic(category, query, out_key, seen, window):
    url = ('https://news.google.com/rss/search?q=' + urllib.request.quote(query) +
           '&hl=zh-CN&gl=CN&ceid=CN:zh-Hans')
    items = []; decoded_ok = 0
    try:
        feed = parse_feed(fetch(url))
    except Exception as e:
        log('   [FAIL] Google主题[%s]: %s' % (category, e)); return items
    for it in feed:
        title, media = split_gnews_title(it['title'])
        source = it['src'] or media
        if not title or norm(title) in seen: continue
        d = bj_date(parse_dt(it['pub']))
        if d not in window: continue
        real_url = decode_gnews(it['link'])
        if real_url: decoded_ok += 1
        items.append({'title': title, 'summary': strip_html(it['desc']),
                      'date': (d.isoformat() if d else datetime.now(BJ).strftime('%Y-%m-%d')),
                      'source_name': source, 'source_url': real_url, 'tags': [], '_key': out_key})
        seen.add(norm(title))
    log('   [OK]  Google主题[%s→%s]: %d 条, 精确原文url %d 条' % (category, out_key, len(items), decoded_ok))
    return items

def fetch_backup(name, category, feed_url, out_key, seen, window):
    items = []
    try: feed = parse_feed(fetch(feed_url))
    except Exception as e:
        log('   [FAIL] 备份源[%s]: %s' % (name, e)); return items
    for it in feed:
        title = it['title'].strip()
        if not title or norm(title) in seen: continue
        d = bj_date(parse_dt(it['pub']))
        if d not in window: continue
        items.append({'title': title, 'summary': strip_html(it['desc']),
                      'date': (d.isoformat() if d else datetime.now(BJ).strftime('%Y-%m-%d')),
                      'source_name': name,
                      'source_url': (it['link'] if it['link'] and 'news.google.com' not in it['link'] else ''),
                      'tags': [], '_key': out_key})
        seen.add(norm(title))
    log('   [OK]  备份源[%s→%s]: %d 条' % (name, out_key, len(items)))
    return items

def inherit_knowledge():
    """知识角: 现有json > data/knowledge.json > 内置默认。绝不丢现有内容。"""
    if os.path.exists(OUT):
        try:
            with open(OUT, 'r', encoding='utf-8') as f: old = json.load(f)
            if isinstance(old, dict):
                for k in ('knowledge', 'knowledge_content', 'knowledge-content', '知识角', 'knowledge_corner'):
                    v = old.get(k)
                    if isinstance(v, list) and v:
                        log('[知识角] 继承现有 json 的 "%s": %d 条' % (k, len(v))); return v
        except Exception as e:
            log('[知识角] 读现有 json 失败: %s' % e)
    if os.path.exists(KNOW):
        try:
            with open(KNOW, 'r', encoding='utf-8') as f: arr = json.load(f)
            if isinstance(arr, list) and arr:
                log('[知识角] 用 data/knowledge.json: %d 条' % len(arr)); return arr
        except Exception as e:
            log('[知识角] knowledge.json 解析失败: %s' % e)
    log('[知识角] 用内置默认并写入 data/knowledge.json')
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(KNOW, 'w', encoding='utf-8') as f: json.dump(DEFAULT_KNOWLEDGE, f, ensure_ascii=False, indent=2)
    except Exception: pass
    return list(DEFAULT_KNOWLEDGE)

def conv(it):   # 去掉内部分桶标记 _key, 输出与现有 json 同构的字段
    return {'title': it['title'], 'summary': it['summary'], 'source_name': it['source_name'],
            'source_url': it['source_url'], 'date': it['date'], 'tags': it.get('tags', [])}
def save_history(out, today):
    """每日快照 + 日期索引, 供前端'往期'翻阅。整体 try 包裹, 失败绝不影响主数据。"""
    try:
        hdir = os.path.join(DATA_DIR, 'history')
        os.makedirs(hdir, exist_ok=True)
        dstr = today.isoformat()
        with open(os.path.join(hdir, dstr + '.json'), 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        idx_path = os.path.join(hdir, 'index.json')
        idx = []
        if os.path.exists(idx_path):
            try:
                with open(idx_path, 'r', encoding='utf-8') as f: idx = json.load(f)
                if not isinstance(idx, list): idx = []
            except Exception: idx = []
        if dstr not in idx: idx.insert(0, dstr)
        idx = [x for x in idx if re.match(r'^\d{4}-\d{2}-\d{2}$', str(x))]  # 只留合法日期, 防脏数据
        idx.sort(reverse=True)
        with open(idx_path, 'w', encoding='utf-8') as f:
            json.dump(idx, f, ensure_ascii=False)
        log('[history] 已存快照 %s.json, 索引共 %d 天' % (dstr, len(idx)))
    except Exception as e:
        log('[history] 写历史快照失败(不影响主数据): %s' % e)
                
def main():
    log('==== 财经日报抓取开始 (北京时间 %s) ====' % datetime.now(BJ).strftime('%Y-%m-%d %H:%M:%S'))
    today = datetime.now(BJ).date()
    window = {today - timedelta(days=i) for i in range(WINDOW_DAYS)}   # 近3天
    seen = set(); news = []
    for category, query, out_key in TOPICS:
        news += fetch_topic(category, query, out_key, seen, window)
    for name, category, feed_url, out_key in BACKUP_RSS:
        news += fetch_backup(name, category, feed_url, out_key, seen, window)

    buckets = {k: [] for _, _, k in TOPICS}
    for it in news:
        buckets.setdefault(it['_key'], []).append(it)
    for k in buckets:
        buckets[k].sort(key=lambda x: x['date'], reverse=True)
        buckets[k] = buckets[k][:PER_CAT]

    total_news = sum(len(v) for v in buckets.values())
    knowledge = inherit_knowledge()
    log('---- 新闻 %d 条 + 知识角 %d 条 ----' % (total_news, len(knowledge)))

    if total_news == 0:
        log('⚠️ 空抓保护触发：本次未抓到新闻，不覆盖 news-data.json，网站保留上一版。')
        return 0

    out = {
        'generated_at': datetime.now(BJ).strftime('%Y-%m-%dT%H:%M:%S+08:00'),
        'dates': today.isoformat(),
        'politics':  [conv(x) for x in buckets.get('politics', [])],
        'trade':     [conv(x) for x in buckets.get('trade', [])],
        'ecommerce': [conv(x) for x in buckets.get('ecommerce', [])],
        'stock':     [conv(x) for x in buckets.get('stock', [])],
        'bond':      [conv(x) for x in buckets.get('bond', [])],
        'fund':      [conv(x) for x in buckets.get('fund', [])],
        'knowledge': knowledge,
    }
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    log('✅ 已写出 %s (嵌套结构, 与现有 json 同构)' % OUT)    save_history(out, today)
    return total_news

if __name__ == '__main__':
    try:
        n = main(); log('==== 抓取结束，新闻条数=%d ====' % n)
    except Exception:
        log('❌ 抓取异常，未写文件，网站保留上一版：\n' + traceback.format_exc()); sys.exit(1)
