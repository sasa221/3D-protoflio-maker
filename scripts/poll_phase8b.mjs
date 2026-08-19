async function check() {
  for (let i = 1; i <= 25; i++) {
    try {
      const html = await fetch('https://portfolio-maker-murex.vercel.app/').then(r => r.text());
      const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
      const asset = m ? m[1] : 'not found';
      console.log(`[Attempt ${i}/25] Live Asset: ${asset}`);
      if (asset !== '/assets/index-BILdPQ1W.js' && asset !== '/assets/index-CxJj5vkH.js' && asset !== '/assets/index-DNPaSDcz.js' && asset !== '/assets/index-GCSbVwzy.js' && asset !== '/assets/index-Bo7lm4pa.js' && asset !== '/assets/index-P70ujDH-.js') {
        console.log(`\n======================================================`);
        console.log(`✅ NEW 8-DIGIT OTP BUNDLE DEPLOYED: ${asset}`);
        console.log(`======================================================\n`);
        const js = await fetch('https://portfolio-maker-murex.vercel.app' + asset).then(r => r.text());
        console.log('Has Generic Verification Text:', js.includes('sent a verification code to'));
        console.log('Has 6-Digit Hardcoded Text:', js.includes('sent a 6-digit verification code'));
        console.log('Has Payment Requests Tab:', js.includes('Payment Requests'));
        console.log('Has 15 Themes:', js.includes('Minimal Orbit') && js.includes('Obsidian Luxe') && js.includes('Quantum Aurora'));
        return;
      }
    } catch (e) {
      console.error('Fetch error:', e.message);
    }
    await new Promise(r => setTimeout(r, 4000));
  }
}
check();
