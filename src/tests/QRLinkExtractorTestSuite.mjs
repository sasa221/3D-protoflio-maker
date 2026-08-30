import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const corpusRoot = process.env.CV_ULTRA_HARD_ROOT || 'C:/Users/DELL/AppData/Local/Temp/cv-import-ultra-hard-4ce418f8348949ad9fdeec0533b7eb77';
const truth = JSON.parse(await fs.readFile(path.join(corpusRoot, 'ground_truth', 'ground_truth_full.json'), 'utf8'));
const imageDir = path.join(corpusRoot, 'qr_assets');
const assets = await fs.readdir(imageDir);
let decoded = 0;
for (const record of truth) {
  const expectedQr = (record.expected_links || []).filter(link => link.source === 'qr');
  if (!expectedQr.length) continue;
  const imageName = assets.find(name => name.includes(record.id.replace('CVX-', 'CVX-')));
  assert.ok(imageName, `${record.id} is missing its QR fixture image.`);
  const png = PNG.sync.read(await fs.readFile(path.join(imageDir, imageName)));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'attemptBoth' });
  assert.equal(result?.data, expectedQr[0].target, `${record.id} QR target was not decoded exactly.`);
  decoded += 1;
}
assert.ok(decoded > 0, 'No QR fixtures were exercised.');
console.log(`QRLinkExtractorTestSuite: decoded ${decoded} QR-only/link fixtures exactly.`);
