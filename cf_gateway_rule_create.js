import { getZeroTrustLists, upsertZeroTrustDNSRule, upsertZeroTrustSNIRule } from './lib/api.js';
import { BLOCK_BASED_ON_SNI } from './lib/constants.js';
import { notifyWebhook } from './lib/utils.js';

const RETRY_COUNT = 2;
const DNS_RULE_NAME = 'CGPS Filter Lists';
const SNI_RULE_NAME = 'CGPS Filter Lists - SNI Based Filtering';

// Mã lỗi HTTP không đáng thử lại (lỗi do request/cấu hình sai,
// gọi lại y hệt cũng sẽ fail giống nhau). 429 (rate limit) và 5xx vẫn được retry.
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 422]);

/**
 * Lấy HTTP status code từ lỗi, hỗ trợ vài hình dạng lỗi phổ biến
 * (fetch Response lỗi, axios-style, hoặc field status/statusCode tùy chỉnh).
 */
function getErrorStatus(err) {
  return err?.status ?? err?.statusCode ?? err?.response?.status;
}

/**
 * Gọi hàm với retry nếu thất bại.
 * Bỏ qua retry cho các lỗi 4xx không đáng thử lại (trừ 429).
 */
async function withRetry(fn, name, retries = RETRY_COUNT) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = getErrorStatus(err);
      const isNonRetryable = NON_RETRYABLE_STATUS_CODES.has(status);

      if (isNonRetryable) {
        // Lỗi do request sai (auth, not found, validation...) — thử lại vô ích
        console.error(`[Fatal] Non-retryable error (status ${status}) in ${name}:`, err);
        throw err;
      }

      if (attempt === retries) {
        console.error(`[Fatal] Final attempt (${attempt}/${retries}) failed in ${name}:`, err);
        throw err;
      }

      // Chỉ log mức warn cho các lần thử chưa phải cuối cùng
      console.warn(`[Retry warn] Attempt ${attempt}/${retries} failed in ${name}, retrying:`, err);
      // Chờ một chút trước khi thử lại (exponential backoff nhẹ)
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Unreachable');
}

try {
  // Lấy danh sách lists (có retry)
  const { result: lists } = await withRetry(() => getZeroTrustLists(), 'getZeroTrustLists');
  if (!lists || !Array.isArray(lists)) {
    throw new Error('Failed to fetch Zero Trust lists: result is empty or invalid');
  }
  console.log(`Fetched ${lists.length} Zero Trust lists`);

  // Upsert DNS rule
  const dnsResult = await withRetry(
    () => upsertZeroTrustDNSRule(lists, DNS_RULE_NAME),
    'upsertZeroTrustDNSRule'
  );
  console.log(`DNS rule applied: ${dnsResult?.id ?? 'unknown id'}`);

  // Upsert SNI rule nếu được bật
  if (BLOCK_BASED_ON_SNI) {
    const sniResult = await withRetry(
      () => upsertZeroTrustSNIRule(lists, SNI_RULE_NAME),
      'upsertZeroTrustSNIRule'
    );
    console.log(`SNI rule applied: ${sniResult?.id ?? 'unknown id'}`);
  } else {
    console.log('SNI blocking disabled, skipping SNI rule.');
  }

  // Gửi thông báo thành công
  await notifyWebhook('CF Gateway Rule Create script finished successfully');
  console.log('Script completed successfully.');
} catch (error) {
  console.error('Fatal error during gateway rule creation:', error);
  try {
    await notifyWebhook(`CF Gateway Rule Create script FAILED: ${error}`);
  } catch (webhookErr) {
    console.error('Additionally failed to send failure webhook:', webhookErr);
  }
  process.exit(1);
}
