async function checkLive() {
  console.log('Checking live production bundle...');
  const res = await fetch(`https://portfolio-maker-murex.vercel.app/?_t=${Date.now()}`);
  const html = await res.text();
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const asset = match ? match[1] : null;
  console.log('Live Asset URL:', asset);

  if (!asset) {
    console.log('Could not find index asset script tag.');
    return null;
  }

  const jsRes = await fetch(`https://portfolio-maker-murex.vercel.app${asset}?_t=${Date.now()}`);
  const js = await jsRes.text();

  const results = {
    asset,
    bundleSize: js.length,
    hasAdminControlCenter: js.includes('Admin Control Center'),
    hasPremium: js.includes('Premium'),
    hasGroups: js.includes('Groups'),
    hasKeepItLive: js.includes('Keep It Live'),
    hasPromoCodes: js.includes('Promo Codes'),
    hasAuditLog: js.includes('Audit Log'),
    hasSystem: js.includes('System & Flags') || js.includes('System'),
    hasMinimalOrbit: js.includes('Minimal Orbit'),
    hasObsidianLuxe: js.includes('Obsidian Luxe'),
    hasQuantumAurora: js.includes('Quantum Aurora'),
    hasSetPro: js.includes('Set Pro'),
    hasSetFree: js.includes('Set Free')
  };

  console.log(JSON.stringify(results, null, 2));
  return results;
}

checkLive().catch(console.error);
