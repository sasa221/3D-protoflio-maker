async function inspect() {
  const htmlRes = await fetch('https://portfolio-maker-murex.vercel.app/');
  const html = await htmlRes.text();
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  console.log('Live Bundle Asset:', match ? match[1] : 'NOT FOUND');

  if (match) {
    const jsRes = await fetch('https://portfolio-maker-murex.vercel.app' + match[1]);
    const js = await jsRes.text();
    console.log('Live Bundle size:', js.length, 'bytes');
    console.log('Has "Admin Control Center":', js.includes('Admin Control Center'));
    console.log('Has "OPERATIONAL MANAGEMENT & ENTITLEMENTS":', js.includes('OPERATIONAL MANAGEMENT & ENTITLEMENTS'));
    console.log('Has "Set Pro":', js.includes('Set Pro'));
    console.log('Has "Set Free":', js.includes('Set Free'));
    console.log('Has "Minimal Orbit":', js.includes('Minimal Orbit'));
    console.log('Has "Obsidian Luxe":', js.includes('Obsidian Luxe'));
    console.log('Has "Quantum Aurora":', js.includes('Quantum Aurora'));
    console.log('Has "Keep It Live Retentions":', js.includes('Keep It Live Retentions'));
    console.log('Has "Manual Plan Override":', js.includes('Manual Plan Override'));
  }
}

inspect().catch(console.error);
