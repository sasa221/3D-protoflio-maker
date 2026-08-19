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
  const index = await fetchUrl('https://portfolio-maker-murex.vercel.app/');
  console.log('Status:', index.status);
  console.log('Age:', index.headers['age'], 'x-vercel-id:', index.headers['x-vercel-id']);
  
  // Find script tags
  const scriptMatches = [...index.body.matchAll(/src=["'](\/assets\/[^"']+)["']/g)];
  console.log('Found JS bundles in index.html:', scriptMatches.map(m => m[1]));

  for (const m of scriptMatches) {
    const scriptUrl = 'https://portfolio-maker-murex.vercel.app' + m[1];
    console.log(`\nFetching ${scriptUrl}...`);
    const js = await fetchUrl(scriptUrl);
    console.log('JS length:', js.body.length);
    const hasTierChipDelegation = js.body.includes('tier-chip') && js.body.includes('open-billing');
    const hasToLocaleStringFix = js.body.includes('formatEGP') || js.body.includes('From 1,500');
    const hasTargetPlanHighlighting = js.body.includes('RECOMMENDED') && js.body.includes('isTargeted');
    console.log('Contains tier-chip delegation:', hasTierChipDelegation);
    console.log('Contains formatEGP / 1,500 fix:', hasToLocaleStringFix);
    console.log('Contains targetPlan highlighting:', hasTargetPlanHighlighting);
  }
}

checkLive();
