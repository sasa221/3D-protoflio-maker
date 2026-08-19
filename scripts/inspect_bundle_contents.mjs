// scripts/inspect_bundle_contents.mjs
import fs from 'fs';
import path from 'path';

const distFiles = fs.readdirSync('./dist/assets').filter(f => f.startsWith('index-') && f.endsWith('.js'));
if (distFiles.length) {
  const localBundle = fs.readFileSync(path.join('./dist/assets', distFiles[0]), 'utf8');
  console.log('Local bundle:', distFiles[0]);
  console.log('Local size:', localBundle.length);
  console.log('Has 1500:', localBundle.includes('1500'));
  console.log('Has billing-modal-overlay:', localBundle.includes('billing-modal-overlay'));
  console.log('Has RECOMMENDED:', localBundle.includes('RECOMMENDED'));
}
