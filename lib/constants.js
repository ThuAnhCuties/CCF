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

// Danh sách allowlist giữ nguyên
export const RECOMMENDED_ALLOWLIST_URLS = [
  "https://raw.githubusercontent.com/im-sm/Pi-hole-Torrent-Blocklist/main/all-torrent-trackres.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/banks.txt",
  "https://raw.githubusercontent.com/Dogino/Discord-Phishing-URLs/main/official-domains.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/mac.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/windows.txt",
  "https://raw.githubusercontent.com/boutetnico/url-shorteners/master/list.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/firefox.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/android.txt",
  "https://raw.githubusercontent.com/TogoFire-Home/AD-Settings/main/Filters/whitelist.txt",
  "https://raw.githubusercontent.com/DandelionSprout/AdGuard-Home-Whitelist/master/whitelist.txt",
  "https://raw.githubusercontent.com/AdguardTeam/AdGuardSDNSFilter/master/Filters/exclusions.txt",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/issues.txt",
];

// 🔥 Chặn mạnh nhất trong giới hạn 300k domain (Cloudflare Free)
// OISD Small (~200k domain) + HaGeZi Pro++ (~160k domain) → tổng unique ~280-300k
// Cả hai đều ở định dạng domain (hỗ trợ wildcard từ OISD)
export const RECOMMENDED_BLOCKLIST_URLS = [
  "https://small.oisd.nl/domainswild",
  "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.plus.txt",
];
