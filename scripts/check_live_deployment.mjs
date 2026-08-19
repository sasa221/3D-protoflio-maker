// scripts/check_live_deployment.mjs
import https from 'https';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function checkLive() {
  console.log('Fetching https://portfolio-maker-murex.vercel.app/...');
  const index = await fetchUrl('https://portfolio-maker-murex.vercel.app/?_t=' + Date.now());
  console.log('Status:', index.status, 'Age:', index.headers['age'], 'x-vercel-id:', index.headers['x-vercel-id']);
  
  const scriptMatches = [...index.body.matchAll(/src=["'](\/assets\/[^"']+)["']/g)];
  console.log('Found JS bundles in live index.html:', scriptMatches.map(m => m[1]));

  for (const m of scriptMatches) {
    const scriptUrl = 'https://portfolio-maker-murex.vercel.app' + m[1] + '?_t=' + Date.now();
    console.log(`\nFetching ${scriptUrl}...`);
    const js = await fetchUrl(scriptUrl);
    console.log('JS length:', js.body.length);
    console.log('Has billing-modal-overlay:', js.body.includes('billing-modal-overlay'));
    console.log('Has RECOMMENDED:', js.body.includes('RECOMMENDED'));
    console.log('Has btn-back-to-plans:', js.body.includes('btn-back-to-plans'));
    console.log('Has tier-chip:', js.body.includes('tier-chip'));
  }
}

checkLive();
