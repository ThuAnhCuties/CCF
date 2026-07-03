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
  "https://raw.githubusercontent.com/im-sm/Pi-hole-Torrent-Blocklist/main/all-torrent-trackres.txt",
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
// Chiến lược: chọn 2 list bao phủ diện rộng, ít trùng nhau nhất, trong giới hạn 300k slot.
//
// Sau dedup thông minh (parent-domain pruning), tổng unique domain thực tế
// thường thấp hơn tổng cộng 30-40% so với tổng thô.
//
// Tier 1 — OISD Big (wildcard, ~360k raw → ~220k sau prune)
//   Lý do chọn Big thay vì Small: Small là subset của Big, dùng Big luôn là tốt hơn.
//   Format: domainswild (có wildcard *.domain → 1 rule cover toàn bộ subdomain)
//
// Tier 2 — HaGeZi Pro++ (~165k raw)
//   Bao phủ malware, phishing, tracking nặng mà OISD bỏ qua.
//   Hai list này bổ sung nhau tốt (~15% overlap), không phải duplicate.
//
// Tổng sau dedup thông minh: ~260-290k → nằm trong giới hạn 300k của Cloudflare Free.
//
// Nếu vượt 300k, ưu tiên cắt từ list có % trùng cao hơn (HaGeZi trước).
export const RECOMMENDED_BLOCKLIST_URLS = [
  // OISD Big — bao phủ quảng cáo + tracking toàn diện nhất, format wildcard
  "https://big.oisd.nl/domainswild",

  // HaGeZi Pro++ — malware, ransomware, phishing, scam, tracking nặng
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.plus.txt",

  // HaGeZi Threat Intelligence Feeds — IOCs, C2, botnet, mã độc đang hoạt động
  // List nhỏ (~15k) nhưng cực kỳ mới và chính xác, bổ sung cho Pro++
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/tif.txt",
];
