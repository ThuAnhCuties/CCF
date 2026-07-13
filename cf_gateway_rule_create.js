import { getZeroTrustLists, upsertZeroTrustDNSRule, upsertZeroTrustSNIRule } from './lib/api.js';
import { BLOCK_BASED_ON_SNI } from './lib/constants.js';
import { notifyWebhook } from './lib/utils.js';

const RETRY_COUNT = 2;
const DNS_RULE_NAME = 'CGPS Filter Lists';
const SNI_RULE_NAME = 'CGPS Filter Lists - SNI Based Filtering';

/**
 * Gọi hàm với retry nếu thất bại.
 */
async function withRetry<T>(fn: () => Promise<T>, name: string, retries: number = RETRY_COUNT): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`[Attempt ${attempt}/${retries}] Error in ${name}:`, err);
      if (attempt === retries) throw err;
      // Chờ một chút trước khi thử lại (exponential backoff nhẹ)
      await new Promise(r => setTimeout(r, 1000 * attempt));
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
  await notifyWebhook(`CF Gateway Rule Create script FAILED: ${error}`);
  process.exit(1);
  }
