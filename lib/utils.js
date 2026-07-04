import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { CLOUDFLARE_RATE_LIMITING_COOLDOWN_TIME, RATE_LIMITING_HTTP_ERROR_CODE } from "./constants.js";

/**
 * Checks if the value is a valid domain.
 * @param {string} value The value to be checked.
 */
export const isValidDomain = (value) =>
  /^\b((?=[a-z0-9-]{1,63}\.)(xn--)?[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,63}\b$/.test(value);

/**
 * Extracts all subdomains from a domain including itself.
 * Returned from most-specific → least-specific (subdomain first, root last).
 * @param {string} domain
 * @returns {string[]}
 */
export const extractDomain = (domain) => {
  const parts = domain.split(".");
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    result.unshift(parts.slice(i).join("."));
  }
  return result;
};

/**
 * Extracts the registrable root domain (eTLD+1) from a domain string.
 * e.g. "ads.sub.example.co.uk" → "example.co.uk"
 * Handles common 2-level TLDs (.co.uk, .com.vn, .net.vn, etc.)
 * @param {string} domain
 * @returns {string}
 */
export const getRootDomain = (domain) => {
  const parts = domain.split(".");
  const twoLevelTLDs = new Set([
    "co.uk","co.nz","co.za","co.jp","co.in","co.id","co.kr","co.il",
    "com.au","com.br","com.cn","com.mx","com.ar","com.vn","com.sg","com.ph","com.hk","com.my",
    "net.vn","net.au","net.br","net.sg","org.uk","org.au","org.vn","org.nz",
    "gov.uk","gov.au","gov.vn","gov.sg","edu.vn","edu.au","edu.sg","ac.uk","ac.nz",
    "ne.jp","or.jp","ad.jp","gr.jp",
  ]);
  if (parts.length >= 3) {
    const candidate = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (twoLevelTLDs.has(candidate)) {
      return parts.slice(-3).join(".");
    }
  }
  return parts.slice(-2).join(".");
};

/**
 * Checks if the value is a comment line.
 * @param {string} value
 */
export const isComment = (value) =>
  value.startsWith("#") ||
  value.startsWith("//") ||
  value.startsWith("!") ||
  value.startsWith("/*") ||
  value.startsWith("*/");

/**
 * Normalizes a raw line from a blocklist/allowlist into a clean domain string.
 * Handles: hosts-file format (0.0.0.0 domain / 127.0.0.1 domain),
 * AdBlock-style (||domain^), plain domain, and strips inline comments.
 * Returns null if the line is invalid or a comment.
 * @param {string} raw
 * @returns {string|null}
 */
export const normalizeLine = (raw) => {
  let line = raw.trim().toLowerCase();

  // Strip inline comments
  const commentIdx = line.indexOf(" #");
  if (commentIdx !== -1) line = line.slice(0, commentIdx).trim();

  if (!line || isComment(line)) return null;

  // AdBlock format: ||domain^ or ||domain^$option
  if (line.startsWith("||")) {
    line = line.slice(2).split("^")[0].split("/")[0];
    // strip wildcard prefix
    if (line.startsWith("*.")) line = line.slice(2);
    return isValidDomain(line) ? line : null;
  }

  // Hosts-file format: "0.0.0.0 domain" or "127.0.0.1 domain"
  const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)/);
  if (hostsMatch) {
    const candidate = hostsMatch[1];
    // skip localhost-style entries
    if (candidate === "0.0.0.0" || candidate === "localhost" || candidate === "broadcasthost") return null;
    return isValidDomain(candidate) ? candidate : null;
  }

  // Wildcard domain: *.example.com
  if (line.startsWith("*.")) line = line.slice(2);

  // Plain domain
  return isValidDomain(line) ? line : null;
};

/**
 * Builds a smart deduplication filter using a Set-based parent-domain index.
 *
 * Algorithm:
 *   - For each domain, check if any of its parent domains already exist in the blocklist.
 *     If yes → skip (already covered by a broader rule).
 *   - When adding a domain, also remove any previously-added subdomains that are now redundant.
 *
 * This yields the minimal set of domains that covers the same block surface
 * with no redundant entries — maximizing Cloudflare's 300k slot limit.
 *
 * @param {Set<string>} allowSet Set of exact allowlisted root domains (and their subdomains covered).
 * @returns {{ add: (domain: string) => boolean, getAll: () => string[], size: () => number }}
 */
export const createSmartBlockSet = (allowSet = new Set()) => {
  // Primary store: all accepted domains
  const blocked = new Set();
  // Inverted index: rootDomain → Set of subdomains currently in `blocked`
  // Used to quickly remove now-redundant subdomains when a parent is added.
  const subIndex = new Map();

  /**
   * Returns true if the domain (or any of its parents) is allowlisted.
   */
  const isAllowed = (domain) => {
    // Check exact match first
    if (allowSet.has(domain)) return true;
    // Check parent chain
    const parts = domain.split(".");
    for (let i = 1; i < parts.length; i++) {
      if (allowSet.has(parts.slice(i).join("."))) return true;
    }
    return false;
  };

  /**
   * Returns true if any parent domain of `domain` is already in the blocked set.
   */
  const isRedundant = (domain) => {
    const parts = domain.split(".");
    for (let i = 1; i < parts.length; i++) {
      if (blocked.has(parts.slice(i).join("."))) return true;
    }
    return false;
  };

  /**
   * Registers a domain in the sub-index so we can clean it up later.
   */
  const indexSubdomain = (domain) => {
    const root = getRootDomain(domain);
    if (!subIndex.has(root)) subIndex.set(root, new Set());
    subIndex.get(root).add(domain);
  };

  /**
   * When adding a broad parent domain, remove all previously stored subdomains.
   */
  const pruneSubdomains = (domain) => {
    const root = getRootDomain(domain);
    const subs = subIndex.get(root);
    if (!subs) return;
    for (const sub of subs) {
      if (sub !== domain && sub.endsWith(`.${domain}`)) {
        blocked.delete(sub);
        subs.delete(sub);
      }
    }
  };

  return {
    /**
     * Attempts to add a domain to the smart block set.
     * @param {string} domain
     * @returns {boolean} true if domain was added, false if skipped.
     */
    add(domain) {
      if (!domain || blocked.has(domain)) return false;
      if (isAllowed(domain)) return false;
      if (isRedundant(domain)) return false;

      // This domain is a new broader rule — prune narrower subdomains already stored
      pruneSubdomains(domain);

      blocked.add(domain);
      indexSubdomain(domain);
      return true;
    },

    getAll() {
      return Array.from(blocked);
    },

    size() {
      return blocked.size;
    },
  };
};

/**
 * Builds an allowlist Set from a file, resolving all subdomains of each entry.
 * Used by createSmartBlockSet to prevent false-positive blocking.
 * @param {string} filePath
 * @returns {Promise<Set<string>>}
 */
export const buildAllowSet = async (filePath) => {
  const allowSet = new Set();
  try {
    await readFile(filePath, (line) => {
      const domain = normalizeLine(line);
      if (domain) allowSet.add(domain);
    });
  } catch {
    // allowlist file may not exist yet — that's fine
  }
  return allowSet;
};

/**
 * Downloads files sequentially and concatenates into one file.
 * Sequential to avoid rate limiting (servers react badly to 20+ parallel requests).
 * @param {string} filePath
 * @param {string[]} urls
 */
export const downloadFiles = async (filePath, urls) => {
  for (const url of urls) {
    const response = await fetchRetry(url);
    const writeStream = createWriteStream(filePath, { flags: "a" });
    await pipeline(response.body, writeStream, { end: false });
    writeStream.end("\n");
  }
};

/**
 * @callback onLine
 * @param {string} line
 * @param {ReturnType<typeof createInterface>} rl
 */

/**
 * Asynchronously reads a file line by line.
 * @param {string} filePath
 * @param {onLine} onLine
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
    console.error(`Error occurred while reading ${basename(filePath)} - ${err.toString()}`);
    throw err;
  }
};

/**
 * Memoizes a function with a Map cache.
 * @template T, R
 * @param {(...fnArgs: T[]) => R} fn
 */
export const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = args.join("\x00");
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Waits for a period of time.
 * @param {number} ms
 */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a message to a Discord-compatible webhook.
 * @param {string|URL} url
 * @param {string} message
 */
async function sendMessageToWebhook(url, message) {
  const payload = { content: message, body: message };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error("Error sending message to webhook:", error);
    return false;
  }
}

/**
 * Sends a CGPS notification to a Discord-compatible webhook.
 * @param {string} msg
 */
export async function notifyWebhook(msg) {
  const webhook_url = process.env.DISCORD_WEBHOOK_URL;
  if (webhook_url && webhook_url.startsWith("http")) {
    try {
      await sendMessageToWebhook(webhook_url, `CGPS: ${msg}`);
    } catch (e) {
      console.error("Error sending message to Discord webhook:", e);
    }
  }
}

/**
 * Fetch with exponential backoff retry.
 * Respects Cloudflare 429 rate limiting with configurable cooldown.
 * @param {Parameters<typeof fetch>} args
 */
export const fetchRetry = async (...args) => {
  const maxAttempts = 50;
  let attempts = 0;
  let response;

  while (attempts < maxAttempts) {
    try {
      response = await fetch(...args);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response;
    } catch (error) {
      attempts++;
      const isRateLimit = response?.status === RATE_LIMITING_HTTP_ERROR_CODE;

      // 4xx errors other than 429 (e.g. 404 Not Found) are not transient —
      // the resource is gone/renamed, so retrying 50 times just wastes ~20+ minutes.
      // Fail fast instead so a single broken URL doesn't stall the whole sync.
      const isPermanentClientError =
        response && response.status >= 400 && response.status < 500 && !isRateLimit;

      if (isPermanentClientError) {
        console.warn(`Web request failed: "${error.message}" — not retrying (permanent client error)`);
        await notifyWebhook(`A permanent HTTP error (${response.status}) occurred for a request. Check logs.`);
        throw error;
      }

      const backoff = isRateLimit
        ? CLOUDFLARE_RATE_LIMITING_COOLDOWN_TIME
        : Math.min(1000 * 2 ** attempts, 30_000); // exponential, cap 30s

      console.warn(
        `Web request failed: "${error.message}" — retry ${attempts}/${maxAttempts}` +
        (isRateLimit ? ` (rate limited, waiting ${backoff / 1000}s)` : ``)
      );

      if (attempts >= maxAttempts) {
        await notifyWebhook(
          `An HTTP error has occurred (${response?.status ?? "unknown"}) after ${maxAttempts} attempts. Check logs.`
        );
        throw error;
      }

      await wait(backoff);
    }
  }
};
