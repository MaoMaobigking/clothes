#!/usr/bin/env node
/**
 * AI HOT 每日早报
 * 调用 aihot.virxact.com 公开 API，拉最近 24h 精选，生成 Markdown 写入 Obsidian 日记
 *
 * 手动跑：node aihot-morning.js
 * 定时：Windows 任务计划程序 每天 8:00 触发
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ===== 配置 =====
const UA = "aihot-skill/0.3.6 (+https://aihot.virxact.com/aihot-skill/)";
const OUTPUT_DIR = path.join(
  process.env.USERPROFILE || "C:\\Users\\13480",
  "Documents\\Obsidian Vault\\日报"
);
const TAKE = 30; // 最多拉 30 条

// ===== 工具函数 =====

/** 带 UA 的 HTTPS GET，返回 JSON */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      headers: { "User-Agent": UA },
      timeout: 20000,
    };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("请求超时"));
    });
    req.end();
  });
}

/** 生成 ISO 8601 时间串（N 小时前） */
function sinceISO(hoursAgo = 24) {
  const d = new Date(Date.now() - hoursAgo * 3600 * 1000);
  return d.toISOString();
}

/** 格式化北京时间的日期字符串 */
function beijingDate() {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
}

/** 安全取值，null/undefined 返回 "—" */
function safe(val, fallback = "—") {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

/** 分类中文名 */
const CATEGORY_CN = {
  "ai-models": "模型",
  "ai-products": "产品",
  industry: "行业",
  paper: "论文",
  tip: "技巧",
};

// ===== 主流程 =====

async function main() {
  console.log("AI HOT 早报 · 开始拉取...\n");

  // 1. 拉最近 24h 精选
  const since = sinceISO(24);
  const itemsUrl = `https://aihot.virxact.com/api/public/items?mode=selected&since=${encodeURIComponent(since)}&take=${TAKE}`;

  let items;
  try {
    items = await fetchJSON(itemsUrl);
  } catch (e) {
    console.error("❌ 拉取 items 失败:", e.message);
    process.exit(1);
  }

  const list = items.data || items.items || items.results || [];
  if (list.length === 0) {
    console.log("⚠️ 过去 24 小时没有新条目");
    return;
  }

  // 2. 生成 Markdown
  const dateStr = beijingDate();
  const timeStr = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  let md = `# ${dateStr} AI 圈早报\n\n`;
  md += `> 自动生成于 ${timeStr} · 数据来源 [AI HOT](https://aihot.virxact.com)\n\n`;
  md += `---\n\n`;
  md += `## 过去 24 小时精选（${list.length} 条）\n\n`;

  list.forEach((item, i) => {
    const title = safe(item.title || item.title_zh, "（无标题）");
    const permalink = safe(item.permalink, "#");
    const source = safe(item.source || item.sourceName);
    const time = safe(item.publishedAt, "").slice(0, 16);
    const summary = safe(item.summary, "");
    const category = CATEGORY_CN[item.category] || safe(item.category, "");

    md += `${i + 1}. [${title}](${permalink})\n`;
    md += `   - ${source}`;
    if (category) md += ` · ${category}`;
    if (time) md += ` · ${time}`;
    md += `\n`;

    if (summary) {
      md += `   - ${summary.slice(0, 120)}${summary.length > 120 ? "…" : ""}\n`;
    }
    md += `\n`;
  });

  md += `---\n`;
  md += `时间窗：过去 24 小时 · 共 ${list.length} 条 · [AI HOT 来源](https://aihot.virxact.com)\n`;

  // 3. 写入文件
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const filePath = path.join(OUTPUT_DIR, `${dateStr} 早报.md`);
  fs.writeFileSync(filePath, md, "utf-8");

  console.log(`✅ 早报已生成：${filePath}`);
  console.log(`   共 ${list.length} 条精选`);
}

main().catch((e) => {
  console.error("❌ 未预期错误:", e);
  process.exit(1);
});
