import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises"; // thêm dòng này
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import {
  CLOUDFLARE_RATE_LIMITING_COOLDOWN_TIME,
  RATE_LIMITING_HTTP_ERROR_CODE,
  LIST_ITEM_LIMIT, // thêm import này
} from "./constants.js";

/**
 * Checks if the value is a valid domain.
 * @param {string} value The value to be checked.
 */
export const isValidDomain = (value) =>
  /^\b((?=[a-z0-9-]{1,63}\.)(xn--)?[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,63}\b$/.test(
    value
  );

/**
 * Extracts all subdomains from a domain including itself.
 * @param {string} domain The domain to be extracted.
 * @returns {string[]}
 */
export const extractDomain = (domain) => {
  const parts = domain.split(".");
  const extractedDomains = [];

  for (let i = 0; i < parts.length; i++) {
    const subdomains = parts.slice(i).join(".");

    extractedDomains.unshift(subdomains);
  }

  return extractedDomains;
};

/**
 * Checks if the value is a comment.
 * @param {string} value The value to be checked.
 */
export const isComment = (value) =>
  value.startsWith("#") ||
  value.startsWith("//") ||
  value.startsWith("!") ||
  value.startsWith("/*") ||
  value.startsWith("*/");

/**
 * Downloads files, extracts domains, and saves only the top most frequent domains
 * up to the limit defined in LIST_ITEM_LIMIT (default 300000).
 * @param {string} filePath The path to the file being written to.
 * @param {string[]} urls The URLs to the files to be downloaded.
 */
export const downloadFiles = async (filePath, urls) => {
  console.log(`Fetching ${urls.length} source(s) for smart filtering...`);

  const allDomains = []; // Mảng chứa tất cả domain thô (có thể trùng lặp)

  // Hàm trích xuất domain từ nội dung text (hỗ trợ hosts, AdGuard filter, domain thuần)
  const extractDomainsFromText = (text) => {
    const lines = text.split("\n");
    const domains = new Set();

    for (const rawLine of lines) {
      // Bỏ comment
      if (isComment(rawLine.trimStart())) continue;

      let line = rawLine.trim();

      // Xử lý định dạng hosts: 0.0.0.0 domain.com hoặc 127.0.0.1 domain.com
      const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(.+)/);
      if (hostsMatch) {
        line = hostsMatch[1].trim();
      }

      // Xử lý định dạng AdGuard filter: ||domain.com^ hoặc ||domain.com^$...
      if (line.startsWith("||")) {
        line = line.slice(2); // bỏ ||
        const caretIndex = line.indexOf("^");
        if (caretIndex > -1) line = line.substring(0, caretIndex);
      }

      // Tách domain có thể có tham số, port, path... ta chỉ lấy phần trước dấu / hoặc khoảng trắng
      const domainCandidate = line.split(/[\s\/]/)[0].toLowerCase();

      // Kiểm tra domain hợp lệ
      if (domainCandidate && isValidDomain(domainCandidate)) {
        domains.add(domainCandidate);
      }
    }
    return [...domains];
  };

  // Tải tuần tự từng nguồn (giữ tính chất cũ để tránh lỗi rate limit)
  for (const url of urls) {
    try {
      console.log(`  Downloading ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const text = await response.text();
      const domains = extractDomainsFromText(text);
      console.log(`    Got ${domains.length} domains`);
      allDomains.push(...domains);
    } catch (err) {
      console.error(`Error downloading ${url}: ${err.message}`);
    }
  }

  // Đếm tần suất xuất hiện
  const frequency = {};
  for (const domain of allDomains) {
    frequency[domain] = (frequency[domain] || 0) + 1;
  }

  // Sắp xếp: tần suất giảm dần, nếu bằng thì alphabet
  const sorted = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([domain]) => domain);

  // Giới hạn số lượng domain
  const limit = LIST_ITEM_LIMIT;
  const topDomains = sorted.slice(0, limit);

  console.log(
    `Total unique domains from all sources: ${Object.keys(frequency).length}`
  );
  console.log(`Keeping top ${topDomains.length} most frequent domains.`);

  // Ghi đè file đầu ra
  await writeFile(filePath, topDomains.join("\n") + "\n", "utf8");
  console.log(`Written to ${filePath}`);
};

/**
 * Asynchronously reads a file line by line.
 * @param {string} filePath The path to the file.
 * @param {onLine} onLine The callback executed on each line read.
 */
export const readFile = async (filePath, onLine) => {
  try {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => onLine(line, rl));

    await once(rl, "close");
  } catch (err) {
    console.error(
      `Error occurred while reading ${basename(filePath)} - ${err.toString()}`
    );
    throw err;
  }
};

/**
 * Memoizes a function
 * @template T The argument type of the function.
 * @template R The return type of the function.
 * @param {(...fnArgs: T[]) => R} fn The function to be memoized.
 */
export const memoize = (fn) => {
  const cache = new Map();

  return (...args) => {
    const key = args.join("-");

    if (cache.has(key)) return cache.get(key);

    const result = fn(...args);

    cache.set(key, result);
    return result;
  };
};

/**
 * Waits for a period of time
 * @param {number} ms The time to wait in milliseconds.
 */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a message to a Discord-compatible webhook.
 * @param {url|string} url The webhook URL.
 * @param {string} message The message to be sent.
 * @returns {Promise}
 */
async function sendMessageToWebhook(url, message) {
  const payload = { content: message, body: message };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    } else {
      return true;
    }
  } catch (error) {
    console.error('Error sending message to webhook:', error);
    return false;
  }
}

/**
 * Sends a CGPS notification to a Discord-compatible webhook.
 * Automatically checks if the webhook URL exists.
 * @param {string} msg The message to be sent.
 * @returns {Promise}
 */
export async function notifyWebhook(msg) {
  const webhook_url = process.env.DISCORD_WEBHOOK_URL;

  if (webhook_url && webhook_url.startsWith('http')) {
    try {
      await sendMessageToWebhook(webhook_url, `CGPS: ${msg}`);
    } catch (e) {
      console.error('Error sending message to Discord webhook:', e);
    }
  }
}

/**
 * Fetches with retry
 * @param  {Parameters<typeof fetch>} args
 */
export const fetchRetry = async (...args) => {
  let attempts = 0;
  let maxAttempts = 50;
  let response;

  while (attempts < maxAttempts) {
    try {
      response = await fetch(...args);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      return response;
    } catch (error) {
      attempts++;
      console.warn(`An error occured while making a web request: "${error}", retrying. Attempt ${attempts} of ${maxAttempts}.\nTHIS IS NORMAL IN MOST CIRCUMSTANCES. Refrain from reporting this as a bug unless the script doesn't automatically recover after several attempts.`);

      if (attempts >= maxAttempts) {
        await notifyWebhook(`An HTTP error has occurred (${response ? response.status : "unknown status"}) while making a web request. Please check the logs for further details.`);
        throw error;
      }

      if (response.status === RATE_LIMITING_HTTP_ERROR_CODE) {
        console.log(`Waiting for ${CLOUDFLARE_RATE_LIMITING_COOLDOWN_TIME / 1000 / 60} minutes to avoid rate limiting.`);
        await wait(CLOUDFLARE_RATE_LIMITING_COOLDOWN_TIME);
      }
    }
  }
}
