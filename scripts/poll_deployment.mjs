async function poll() {
  console.log('Checking live production deployment status...');
  for (let i = 0; i < 12; i++) {
    const htmlRes = await fetch(`https://portfolio-maker-murex.vercel.app/?_t=${Date.now()}`);
    const html = await htmlRes.text();
    const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    const asset = match ? match[1] : '';
    console.log(`[Attempt ${i+1}] Current Live Asset:`, asset);

    if (asset) {
      const jsRes = await fetch(`https://portfolio-maker-murex.vercel.app${asset}?_t=${Date.now()}`);
      const js = await jsRes.text();
      const hasNewAdmin = js.includes('Admin Control Center');
      const has15Themes = js.includes('Minimal Orbit') && js.includes('Obsidian Luxe') && js.includes('Quantum Aurora');
      console.log(`   -> Has "Admin Control Center": ${hasNewAdmin} | Has 15 Themes: ${has15Themes}`);

      if (hasNewAdmin && has15Themes) {
        console.log('\n🎉 SUCCESS: Live production has updated to the latest Phase 8A.6 deployment!');
        return true;
      }
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log('Vercel deployment is still processing or cached.');
  return false;
}

poll().catch(console.error);
