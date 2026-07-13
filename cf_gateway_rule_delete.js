import { deleteZeroTrustRule, getZeroTrustRules } from './lib/api.js';
import { DELETION_ENABLED } from './lib/constants.js';
import { notifyWebhook } from './lib/utils.js';

if (!DELETION_ENABLED) {
  console.warn(
    'The rule deletion step is no longer needed to update filter lists, safely skipping. To proceed with deletion to e.g. stop using CGPS, set the environment variable CGPS_DELETION_ENABLED=true and re-run the script. Exiting.'
  );
  process.exit(0);
}

try {
  const { result: rules } = await getZeroTrustRules();
  const cgpsRules = rules.filter(({ name }) => name.startsWith('CGPS Filter Lists'));

  if (!cgpsRules.length) {
    console.warn(
      "No rule(s) with matching name found - this is not an issue if you haven't run the create script yet. Exiting."
    );
  } else {
    for (const cgpsRule of cgpsRules) {
      console.log(`Deleting rule ${cgpsRule.name}...`);
      await deleteZeroTrustRule(cgpsRule.id);
    }
  }

  // Send a notification to the webhook
  await notifyWebhook('CF Gateway Rule Delete script finished running');
  console.log('Script completed successfully.');
} catch (error) {
  console.error('Fatal error during gateway rule deletion:', error);
  try {
    await notifyWebhook(`CF Gateway Rule Delete script FAILED: ${error}`);
  } catch (webhookErr) {
    console.error('Additionally failed to send failure webhook:', webhookErr);
  }
  process.exit(1);
}
