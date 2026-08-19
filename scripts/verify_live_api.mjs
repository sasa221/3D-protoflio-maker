// scripts/verify_live_api.mjs
async function testApi() {
  console.log('Testing live serverless endpoints...\n');

  try {
    const configRes = await fetch('https://portfolio-maker-murex.vercel.app/api/billing?action=payment-config');
    console.log('GET /api/billing?action=payment-config HTTP status:', configRes.status);
    const configData = await configRes.json();
    console.log('Payment Config Response:', configData);
  } catch (e) {
    console.error('Payment Config API Error:', e.message);
  }

  try {
    const healthRes = await fetch('https://portfolio-maker-murex.vercel.app/api/admin?action=health');
    console.log('\nGET /api/admin?action=health HTTP status:', healthRes.status);
    const healthData = await healthRes.json();
    console.log('Admin Health Response:', healthData);
  } catch (e) {
    console.error('Admin Health API Error:', e.message);
  }
}
testApi();
