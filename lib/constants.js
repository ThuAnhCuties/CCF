import dotenv from "dotenv";

dotenv.config();

if (process.env.CLOUDFLARE_API_KEY) {
  console.warn(
    "Using Global API Key is very risky for your Cloudflare account. It is strongly recommended to create an API Token with scoped permissions instead."
  );
}

export const API_KEY = process.env.CLOUDFLARE_API_KEY;
export const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
export const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
export const ACCOUNT_EMAIL = process.env.CLOUDFLARE_ACCOUNT_EMAIL;

export const LIST_ITEM_LIMIT = isNaN(process.env.CLOUDFLARE_LIST_ITEM_LIMIT)
  ? 300000
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
  ? process.env.ALLOWLIST_URLS.split("\n").filter((x) => x)
  : undefined;

export const USER_DEFINED_BLOCKLIST_URLS = process.env.BLOCKLIST_URLS
  ? process.env.BLOCKLIST_URLS.split("\n").filter((x) => x)
  : undefined;

export const RECOMMENDED_ALLOWLIST_URLS = [
  // ... giữ nguyên danh sách allowlist của bạn ...
];

// 🔥 Cơ chế thông minh: tải từ NHIỀU NGUỒN, sau đó ưu tiên domain xuất hiện nhiều lần
// Tổng số domain duy nhất có thể vượt 1 triệu, nhưng script sẽ chỉ lấy top 300k quan trọng nhất
export const RECOMMENDED_BLOCKLIST_URLS = [
  // OISD Big (đầy đủ nhất, ~400k domain wildcard)
  "https://big.oisd.nl/domainswild",
  // HaGeZi Pro++ (mạnh tay, ~160k domain)
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.plus.txt",
  // AdGuard DNS filter (tổng hợp quảng cáo phổ biến, ~50k)
  "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
  // EasyList (dành cho trình duyệt, nhưng trích xuất domain vẫn hiệu quả)
  "https://easylist.to/easylist/easylist.txt",
  // Peter Lowe's list (quảng cáo, theo dõi, ~10k)
  "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext",
  // NoCoin (chặn miner, ~1k)
  "https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/hosts.txt",
  // SomeoneWhoCares (hosts file tổng hợp)
  "https://someonewhocares.org/hosts/zero/hosts",
];
