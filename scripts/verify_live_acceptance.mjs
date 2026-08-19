// scripts/verify_live_acceptance.mjs
async function run() {
  const html = await fetch('https://portfolio-maker-murex.vercel.app/').then(r => r.text());
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const bundle = match ? match[1] : 'unknown';
  console.log('LIVE BUNDLE:', bundle);

  const js = await fetch('https://portfolio-maker-murex.vercel.app' + bundle).then(r => r.text());
  console.log('1. Generic Verification Text:', js.includes('sent a verification code to'));
  console.log('2. 6-Digit Hardcoded Text:', js.includes('sent a 6-digit verification code'));
  console.log('3. Legacy 200 EGP Text:', js.includes('200 جنيه مصري') || js.includes('200 ج.م'));
  console.log('4. Legacy WhatsApp Link:', js.includes('wa.me/201270024222'));
  console.log('5. 15 Themes Catalog:', js.includes('Minimal Orbit') && js.includes('Obsidian Luxe') && js.includes('Quantum Aurora'));
  console.log('6. Billing Modal Component:', js.includes('openBillingModal') || js.includes('Upgrade Your 3D Portfolio Experience'));
  console.log('7. Scoped Storage Service:', js.includes('usr_') || js.includes('getScopedKey'));
  console.log('8. Payment Config Action:', js.includes('payment-config'));
}
run();
