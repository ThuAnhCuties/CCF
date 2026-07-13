import { resolve } from 'node:path';

import {
  LIST_TYPE,
  PROCESSING_FILENAME,
  RECOMMENDED_ALLOWLIST_URLS,
  RECOMMENDED_BLOCKLIST_URLS,
  USER_DEFINED_ALLOWLIST_URLS,
  USER_DEFINED_BLOCKLIST_URLS,
} from './lib/constants.js';
import { downloadFiles } from './lib/utils.js';

const DOWNLOAD_TIMEOUT_MS = 30_000;
const VALID_LIST_TYPES = Object.values(LIST_TYPE);

const allowlistUrls =
  USER_DEFINED_ALLOWLIST_URLS.length > 0
    ? USER_DEFINED_ALLOWLIST_URLS
    : RECOMMENDED_ALLOWLIST_URLS;
const blocklistUrls =
  USER_DEFINED_BLOCKLIST_URLS.length > 0
    ? USER_DEFINED_BLOCKLIST_URLS
    : RECOMMENDED_BLOCKLIST_URLS;

const listType = process.argv[2];

// 3. Validate listType đầu vào — báo lỗi rõ ràng thay vì âm thầm rơi vào nhánh default
if (listType !== undefined && !VALID_LIST_TYPES.includes(listType)) {
  console.error(
    `Lỗi: "${listType}" không phải list type hợp lệ. Giá trị cho phép: ${VALID_LIST_TYPES.join(', ')} (hoặc để trống để chạy cả hai).`
  );
  process.exit(1);
}

async function downloadLists(filename, urls) {
  // Sử dụng process.cwd() để file được tạo ở thư mục làm việc hiện tại
  const filePath = resolve(process.cwd(), filename);

  // 1. Timeout để tránh treo vô thời hạn nếu URL không phản hồi
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    // Hàm downloadFiles sẽ tự động ghi đè file, không cần xóa trước
    await downloadFiles(filePath, urls, { signal: controller.signal });

    console.log(
      `Done. The ${filename} file contains merged data from the following list(s):`
    );
    console.log(urls.map((url, i) => `${i + 1}. ${url}`).join('\n'));
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(
        `Timeout: quá ${DOWNLOAD_TIMEOUT_MS / 1000}s khi tải ${filename}.`
      );
    } else {
      console.error(`An error occurred while processing ${filename}:\n`, err);
    }
    console.error('URLs:\n', urls);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Top-level async wrapper để tránh lỗi unresolved promise
(async () => {
  const startTime = Date.now();

  switch (listType) {
    case LIST_TYPE.ALLOWLIST:
      await downloadLists(PROCESSING_FILENAME.ALLOWLIST, allowlistUrls);
      break;
    case LIST_TYPE.BLOCKLIST:
      await downloadLists(PROCESSING_FILENAME.BLOCKLIST, blocklistUrls);
      break;
    default: {
      // 2. allSettled thay vì all — một danh sách lỗi không làm mất kết quả danh sách còn lại
      const results = await Promise.allSettled([
        downloadLists(PROCESSING_FILENAME.ALLOWLIST, allowlistUrls),
        downloadLists(PROCESSING_FILENAME.BLOCKLIST, blocklistUrls),
      ]);

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        console.error(`${failed.length} danh sách tải thất bại.`);
        process.exitCode = 1;
      }
    }
  }

  // 4. Log tổng thời gian chạy
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Hoàn tất sau ${elapsedSeconds}s.`);
})();
