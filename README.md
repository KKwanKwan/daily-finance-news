# Daily Finance Brief · 每日财经日报

> 全自动财经资讯聚合站 — 每日 8:00 自动抓取、诚实溯源、可翻往期、暗色模式，零人工干预。

[![GitHub Pages](https://img.shields.io/badge/Host-GitHub_Pages-blue)](https://kkwankwan.github.io/daily-finance-news/)
[![GitHub Actions](https://img.shields.io/badge/CI--CD-GitHub_Actions-success)](https://github.com/KKwanKwan/daily-finance-news/actions)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 项目简介

本项目是一个**纯静态托管**的财经资讯聚合网站，通过 GitHub Actions 定时任务每日自动从 Google News 抓取时政、国际贸易、跨境电商、股市、债券、基金六大板块新闻，结合内置知识角，生成结构化 JSON 数据并由前端渲染为卡片式资讯页。

核心设计哲学：**绝不伪造数据来源与链接**——能确证的标来源、能解码的给原文、解不出的走诚实检索入口，用一条黄色溯源条坦诚展示当前数据完备度，而非用假蓝链伪装专业。

---

## 核心功能

| 功能 | 说明 |
|------|------|
| **每日自动抓取** | GitHub Actions 定时任务（cron: 0 8 * * *），每日 8:00 自动运行，抓取后 bot 自动 commit & push，Pages 自动重建 |
| **诚实溯源系统** | 三级溯源标识：黑字确证来源 / 橙色推断来源（标"建议核实"）/ 红色无法判定，顶部统计条实时计数 |
| **链接不造假** | 精确原文（蓝链）/ 检索直达（青链，用"权威源头+标题"生成百度检索入口）/ 站点首页（灰链），系统绝不伪造精确原文 URL |
| **分类资讯卡片** | 六大板块（时政/国际贸易/跨境电商/股市/债券/基金）+ 知识角，每类最多 8 条，按日期排序 |
| **往期归档** | 后端每日自动快照 + 日期索引，前端弹窗按日期翻阅历史资讯，视觉与主页完全一致 |
| **暗色模式** | 一键切换暗色/亮色主题，偏好自动存入 localStorage |
| **全文搜索** | 实时过滤标题、摘要、分类关键词 |
| **空抓保护** | 当日未抓取到新闻时不覆盖已有 json，网站保留上一版内容，保证可用性 |
| **备份源兜底** | Google News 不可用时自动切换 BBC中文 / 德国之声中文 RSS 备份源 |

---

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| **前端** | 原生 JavaScript (ES5 兼容)、CSS3 (CSS Variables 主题变量)、语义化 HTML5 |
| **后端脚本** | Python 3（urllib + xml.etree 标准库，零第三方依赖） |
| **数据格式** | JSON（嵌套分类结构，与前端渲染逻辑同构） |
| **自动化** | GitHub Actions（cron 定时任务 + bot 自动提交推送） |
| **托管** | GitHub Pages（纯静态托管，零服务器成本） |
| **数据源** | Google News RSS + BBC中文 RSS / 德国之声中文 RSS（备份） |

---

## 架构概览

```
┌─────────────────┐     cron:0 8 * * *     ┌──────────────────┐
│  GitHub Actions  │ ───────────────────►  │  fetch_news.py   │
│  (定时调度器)     │                        │  (Python 抓取器)  │
└─────────────────┘                        └────────┬─────────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │  news-data.  │
                                              │  json        │
                                              │  (嵌套结构)   │
                                              └──────┬───────┘
                                                     │ bot commit & push
                                                     ▼
                                              ┌──────────────────┐
                                              │  GitHub Pages    │
                                              │  (自动重建站点)    │
                                              └──────┬───────────┘
                                                     │
                                                     ▼
                                              ┌──────────────────┐
                                              │  main.js         │
                                              │  (前端渲染引擎)    │
                                              │  - 递归JSON挖掘   │
                                              │  - 卡片渲染       │
                                              │  - 溯源统计       │
                                              │  - 往期归档       │
                                              │  - 暗色模式       │
                                              │  - 全文搜索       │
                                              └──────────────────┘
```

---

## 数据流说明

1. **抓取阶段**：脚本按六大主题构造 Google News RSS 查询 URL，解析 XML 提取标题/链接/摘要/发布时间/来源；标题经 `Google News 跳转URL解码器` 还原真实文章地址；去重后按分类桶装。
2. **写入阶段**：合并知识角（继承旧 json > knowledge.json > 内置默认），输出嵌套结构 JSON 至 `data/news-data.json`；同时写入当日快照至 `data/history/{日期}.json` 并维护 `data/history/index.json` 日期索引。
3. **部署阶段**：bot 自动 git add → commit → push → GitHub Pages 自动重建（约 1-2 分钟）。
4. **渲染阶段**：浏览器加载页面 → fetch json → 递归挖掘嵌套结构中的新闻条目 → 按分类渲染卡片 → 计算溯源统计 → 渲染顶部状态条。

---

## 关键设计决策

### 1. 为什么选择纯静态 + GitHub Actions 而非后端服务？

- **零服务器成本**：GitHub Pages 免费托管静态文件，Actions 每月 2000 分钟免费额度
- **Git 即数据库**：所有数据变更通过 git history 可追溯，天然版本控制
- **安全边界清晰**：抓取脚本在 GitHub 私有 runner 上运行，不暴露任何密钥或内部地址
- **适合个人项目**：日更频率低、数据量小，无需引入数据库和后端框架增加复杂度

### 2. "诚实溯源"设计取舍

| 设计项 | 选择 | 理由 |
|--------|------|------|
| 来源标注 | 三级制（确证/推断/缺失） | 区分"数据确有的"和"系统猜的"，不模糊边界 |
| 链接策略 | 精确原文 > 检索直达 > 站点首页 | 能给的给精确的，给不了的诚实标"检索"，绝不编 URL |
| 溯源条颜色 | 全绿=完美 / 黄色=有兜底 | 用颜色直观展示数据完备度，黄色不是 bug 是诚实 |

### 3. 容错设计

- **空抓保护**：当日 Google News 返回空结果时不写文件，网站保留上一版
- **备份源**：Google News 不可用时自动降级到 BBC/德国之声 RSS
- **历史快照隔离**：`save_history` 函数整体 try/except 包裹，失败不影响主数据写入
- **前端兜底**：往期弹窗 fetch 失败时显示"暂无归档"而非白屏或 spinner 死锁

---

## 项目亮点（简历可引用）

> 以下为可从本项目中提取的技术能力标签，供简历撰写参考：

- **自动化运维**：设计并实现基于 GitHub Actions cron 的每日自动化数据管道，涵盖抓取→清洗→结构化→写入→版本控制→静态站点重建全链路，实现 7×24 无人值守运行。
- **Web 爬虫开发**：基于 Python 标准库（urllib + xml.etree）实现 RSS/Atom Feed 解析器，支持 Google News 跳转 URL 的 Base64 解码还原、多源去重、时间窗口过滤。
- **前端工程化**：零框架原生 JS 实现递归 JSON 树挖掘引擎，兼容任意嵌套层级的数据源结构；CSS Variables 实现主题系统；模块化事件绑定与 DOM 操作。
- **数据完整性设计**：空抓保护、备份源降级、历史快照隔离等容错机制，保障服务可用性。
- **产品思维**：以"诚实溯源"为核心价值观，设计三级来源标识与链接分级策略，用可视化统计条透明展示数据质量，区别于市面上多数伪造来源的资讯聚合站。

---

## 快速开始

### 本地运行抓取脚本

```bash
# 克隆仓库
git clone https://github.com/KKwanKwan/daily-finance-news.git
cd daily-finance-news

# 运行抓取器（需联网）
python3 scripts/fetch_news.py

# 输出: data/news-data.json
```

### 本地预览站点

```bash
# 使用任意静态服务器
python3 -m http.server 8080
# 访问 http://localhost:8080
```

### 部署到 GitHub Pages

1. 将仓库推送到 GitHub
2. Settings → Pages → Source 选择 `main` 分支 + `/ (root)`
3. GitHub Actions 会自动配置定时任务（`.github/workflows/daily-fetch.yml`）

---

## 文件结构

```
daily-finance-news/
├── index.html                  # 站点首页
├── css/
│   └── style.css               # 样式表
├── js/
│   └── main.js                 # 前端渲染引擎（递归挖掘+卡片渲染+溯源+往期+暗色模式）
├── scripts/
│   └── fetch_news.py           # Python 抓取器（Google News + 备份源）
├── data/
│   ├── news-data.json          # 主数据文件（嵌套分类结构）
│   ├── knowledge.json          # 知识角数据
│   └── history/                # 历史快照目录（自动维护）
│       ├── index.json          # 日期索引
│       └── YYYY-MM-DD.json     # 每日快照
├── .github/
│   └── workflows/
│       └── daily-fetch.yml     # GitHub Actions 定时任务配置
└── README.md                   # 本文件
```

---

## 许可证

MIT License — 详见 [LICENSE](LICENSE) 文件。
