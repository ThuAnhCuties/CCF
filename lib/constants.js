import dotenv from "dotenv";

dotenv.config();

if (process.env.CLOUDFLARE_API_KEY) {
  console.warn(
    "Using Global API Key is very risky for your Cloudflare account. " +
    "It is strongly recommended to create an API Token with scoped permissions instead."
  );
}

export const API_KEY = process.env.CLOUDFLARE_API_KEY;
export const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
export const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
export const ACCOUNT_EMAIL = process.env.CLOUDFLARE_ACCOUNT_EMAIL;

export const LIST_ITEM_LIMIT = isNaN(process.env.CLOUDFLARE_LIST_ITEM_LIMIT)
  ? 300_000
  : parseInt(process.env.CLOUDFLARE_LIST_ITEM_LIMIT, 10);

export const LIST_ITEM_SIZE = 1000;
export const API_HOST = "https://api.cloudflare.com/client/v4";
export const DRY_RUN = !!parseInt(process.env.DRY_RUN, 10);
export const DELETION_ENABLED = !!process.env.CGPS_DELETION_ENABLED;
export const BLOCK_PAGE_ENABLED = !!parseInt(process.env.BLOCK_PAGE_ENABLED, 10);
export const BLOCK_BASED_ON_SNI = !!parseInt(process.env.BLOCK_BASED_ON_SNI, 10);
export const DEBUG = !!parseInt(process.env.DEBUG, 10);
export const CLOUDFLARE_RATE_LIMITING_COOLDOWN_TIME = 2 * 60 * 1000;
export const RATE_LIMITING_HTTP_ERROR_CODE = 429;

export const PROCESSING_FILENAME = {
  ALLOWLIST: "allowlist.txt",
  BLOCKLIST: "blocklist.txt",
  OLD_ALLOWLIST: "whitelist.csv",
  OLD_BLOCKLIST: "input.csv",
};

export const LIST_TYPE = {
  ALLOWLIST: "allowlist",
  BLOCKLIST: "blocklist",
};

export const USER_DEFINED_ALLOWLIST_URLS = process.env.ALLOWLIST_URLS
  ? process.env.ALLOWLIST_URLS.split("\n").filter(Boolean)
  : undefined;

export const USER_DEFINED_BLOCKLIST_URLS = process.env.BLOCKLIST_URLS
  ? process.env.BLOCKLIST_URLS.split("\n").filter(Boolean)
  : undefined;

// ─── ALLOWLIST ──────────────────────────────────────────────────────────────
// Bảo vệ các domain quan trọng khỏi bị chặn nhầm:
// banks, CDN, OS update, browser, Discord, URL shorteners, v.v.
export const RECOMMENDED_ALLOWLIST_URLS = [
  // Torrent trackers — tránh chặn nhầm tracker hợp lệ
  "https://raw.githubusercontent.com/sakib-m/Pi-hole-Torrent-Blocklist/main/all-torrent-trackers.txt",
  // Banks & financial
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/banks.txt",
  // Discord official domains (phân biệt với phishing)
  "https://raw.githubusercontent.com/Dogino/Discord-Phishing-URLs/main/official-domains.txt",
  // OS & browser update endpoints (không block update)
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/mac.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/windows.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/firefox.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/android.txt",
  // URL shorteners (nhiều dịch vụ hợp lệ dùng)
  "https://raw.githubusercontent.com/boutetnico/url-shorteners/master/list.txt",
  // Community-maintained whitelists
  "https://raw.githubusercontent.com/TogoFire-Home/AD-Settings/main/Filters/whitelist.txt",
  "https://raw.githubusercontent.com/DandelionSprout/AdGuard-Home-Whitelist/master/whitelist.txt",
  // AdGuard DNS exclusions (CDN, OCSP, telemetry an toàn)
  "https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt",
  // Broken/known-false-positive domains
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/issues.txt",
];

// ─── BLOCKLIST ───────────────────────────────────────────────────────────────
// Chiến lược: ưu tiên an toàn (ít false positive) trước, bảo vệ đủ 300k slot.
//
// Sau dedup thông minh (parent-domain pruning), tổng unique domain thực tế
// thường thấp hơn tổng cộng 30-40% so với tổng thô.
//
// Thứ tự dưới đây LÀ thứ tự ưu tiên khi tổng vượt 300k slot của Cloudflare Free:
// domain xuất hiện trong các URL đứng trước sẽ được giữ lại trước,
// URL đứng cuối cùng là URL bị cắt bớt/bỏ đầu tiên nếu thiếu chỗ.
//
// Tier 1 — OISD Big (wildcard, ~360k raw → ~220k sau prune)
//   Ưu tiên cao nhất: "passes the girlfriend test", gần như không false positive.
//   Format: domainswild (có wildcard *.domain → 1 rule cover toàn bộ subdomain)
//
// Tier 2 — HaGeZi Pro (thay cho Pro++ trước đây)
//   "Should not lead to any restrictions for the most part" theo HaGeZi FAQ —
//   an toàn hơn đáng kể so với Pro++ (Pro++ "may contain a few false positive
//   domains that limit functionality"). Đổi để giảm rủi ro chặn nhầm domain
//   hợp lệ (ví dụ: OTA/update endpoint của các hãng phần cứng).
//
// Tier 3 — HaGeZi Threat Intelligence Feeds (TIF)
//   Malware/C2/botnet đang hoạt động — quan trọng nhưng đặt SAU CÙNG vì đây là
//   URL sẽ bị cắt bớt trước tiên nếu tổng domain vượt giới hạn 300k, do 2 tier
//   trên (OISD + Pro) ít rủi ro false-positive hơn và cần được bảo toàn.
//
// Nếu vượt 300k, unify tại download_lists.js/cf_list_create.js sẽ cắt theo thứ
// tự xuất hiện trong blocklist.txt gộp — tức TIF (thêm cuối) bị cắt trước.
export const RECOMMENDED_BLOCKLIST_URLS = [
  // OISD Big — bao phủ quảng cáo + tracking toàn diện nhất, format wildcard, ít false positive nhất
  "https://big.oisd.nl/domainswild",

  // HaGeZi Pro — mạnh hơn Normal, vẫn an toàn hơn Pro++: "should only very
  // rarely lead to restrictions" theo HaGeZi FAQ (Pro++ "may contain a few
  // false positive domains that limit functionality")
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt",

  // HaGeZi Threat Intelligence Feeds — IOCs, C2, botnet, mã độc đang hoạt động
  // List nhỏ (~15k) nhưng cực kỳ mới và chính xác, bổ sung cho Pro
  // Đặt cuối vì đây là URL bị cắt bớt trước tiên nếu tổng vượt 300k slot
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/tif.txt",
];
