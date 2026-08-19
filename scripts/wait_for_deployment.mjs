async function waitForDeployment() {
  console.log('Polling Vercel production deployment for commit b6a45bf...');
  const maxAttempts = 30;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(`https://portfolio-maker-murex.vercel.app/?_nocache=${Date.now()}`);
      const html = await res.text();
      const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
      const asset = match ? match[1] : null;

      if (asset) {
        const jsRes = await fetch(`https://portfolio-maker-murex.vercel.app${asset}?_nocache=${Date.now()}`);
        const js = await jsRes.text();

        const hasAdminControlCenter = js.includes('Admin Control Center');
        const hasMinimalOrbit = js.includes('Minimal Orbit');
        const hasObsidianLuxe = js.includes('Obsidian Luxe');
        const hasQuantumAurora = js.includes('Quantum Aurora');
        const hasKeepItLive = js.includes('Keep It Live');
        const hasPromoCodes = js.includes('Promo Codes');
        const hasAuditLog = js.includes('Audit Log');
        const hasSetPro = js.includes('Set Pro');
        const hasSetFree = js.includes('Set Free');

        console.log(`[Attempt ${i}/${maxAttempts}] Asset: ${asset} | AdminControlCenter: ${hasAdminControlCenter} | Themes: ${hasMinimalOrbit && hasObsidianLuxe} | SetPro: ${hasSetPro}`);

        if (hasAdminControlCenter && hasMinimalOrbit && !hasSetPro && !hasSetFree) {
          console.log('\n======================================================');
          console.log('✅ VERCEL DEPLOYMENT VERIFIED FOR COMMIT b6a45bf!');
          console.log('======================================================');
          console.log({
            asset,
            bundleSize: js.length,
            AdminControlCenter: hasAdminControlCenter,
            Premium: js.includes('Premium'),
            Groups: js.includes('Groups'),
            Hosting: hasKeepItLive,
            PromoCodes: hasPromoCodes,
            Themes: hasMinimalOrbit && hasObsidianLuxe && hasQuantumAurora,
            AuditLog: hasAuditLog,
            System: js.includes('System & Flags') || js.includes('System'),
            SetPro: hasSetPro,
            SetFree: hasSetFree
          });
          return true;
        }
      }
    } catch (err) {
      console.error(`Attempt ${i} error:`, err.message);
    }
    await new Promise(r => setTimeout(r, 6000));
  }

  console.log('\n❌ Polling timed out. Deployment still pending on Vercel.');
  return false;
}

waitForDeployment().catch(console.error);
