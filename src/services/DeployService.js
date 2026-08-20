/**
 * DeployService.js
 * Auto-deploy portfolios to Netlify via REST API
 * Pro users get a live URL instantly with one click!
 * 
 * SETUP: Add your Netlify Personal Access Token below.
 * Get it from: https://app.netlify.com/user/applications#personal-access-tokens
 */

// ─── NETLIFY CONFIG ─────────────────────────
// Removed for security: Netlify deployment has been moved to backend via /api/portfolio?action=deploy
const NETLIFY_TOKEN = '';
const NETLIFY_API = 'https://api.netlify.com/api/v1';

// ─── DEPLOYED SITES REGISTRY (local) ────────
const SITES_KEY = 'ultra3d_deployed_sites';

function getSites() {
  try { return JSON.parse(localStorage.getItem(SITES_KEY) || '[]'); } catch { return []; }
}
function saveSites(sites) {
  localStorage.setItem(SITES_KEY, JSON.stringify(sites));
}

/**
 * Auto-deploy a portfolio HTML to Netlify and return the live URL.
 * @param {string} htmlContent - The full HTML string to deploy
 * @param {string} siteName - Slug name for the site (e.g. "john-doe-portfolio")
 * @param {function} onProgress - Callback for status updates (message, percent)
 * @returns {{ url: string, siteId: string, deployId: string }}
 */
export async function deployToNetlify(htmlContent, siteName, onProgress) {
  throw new Error('Legacy client-side deploy is disabled for security. Please use the server API.');

  // Clean slug
  const slug = siteName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  const finalSlug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;

  onProgress?.('Creating your live site...', 20);

  // Step 1: Create a new Netlify site
  const createRes = await fetch(`${NETLIFY_API}/sites`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NETLIFY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: finalSlug,
      custom_domain: null
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(`Failed to create site: ${err.message || createRes.status}`);
  }

  const site = await createRes.json();
  const siteId = site.id;
  const siteUrl = `https://${site.subdomain}.netlify.app`;

  onProgress?.('Uploading your 3D portfolio...', 60);

  // Step 2: Create a deploy with the HTML file
  // Netlify File Digest Deploy: send files as a zip or individual files
  const blob = new Blob([htmlContent], { type: 'text/html' });

  // Use the direct file deploy endpoint
  const deployRes = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NETLIFY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: {
        '/index.html': await sha1(htmlContent)
      },
      draft: false
    })
  });

  if (!deployRes.ok) {
    const err = await deployRes.json().catch(() => ({}));
    throw new Error(`Failed to start deploy: ${err.message || deployRes.status}`);
  }

  const deploy = await deployRes.json();
  const deployId = deploy.id;

  onProgress?.('Pushing files to CDN...', 75);

  // Step 3: Upload the actual file
  const uploadRes = await fetch(`${NETLIFY_API}/deploys/${deployId}/files/index.html`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${NETLIFY_TOKEN}`,
      'Content-Type': 'application/octet-stream'
    },
    body: blob
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(`Failed to upload file: ${err.message || uploadRes.status}`);
  }

  onProgress?.('Finalizing & going live...', 90);

  // Step 4: Poll until deploy is ready (max 30 seconds)
  const liveUrl = await pollDeployReady(deployId, siteUrl);

  onProgress?.('Your site is LIVE! 🎉', 100);

  // Save to registry
  const sites = getSites();
  sites.unshift({
    siteId,
    deployId,
    url: liveUrl,
    name: siteName,
    slug: finalSlug,
    deployedAt: new Date().toISOString()
  });
  saveSites(sites.slice(0, 20)); // Keep last 20

  return { url: liveUrl, siteId, deployId };
}

/**
 * Poll Netlify until deploy is "ready" state
 */
async function pollDeployReady(deployId, fallbackUrl, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(2000);
    try {
      const res = await fetch(`${NETLIFY_API}/deploys/${deployId}`, {
        headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state === 'ready' && data.deploy_url) {
          return data.deploy_url;
        }
        if (data.state === 'error') {
          throw new Error('Deploy failed on Netlify side.');
        }
      }
    } catch (e) {
      if (e.message.includes('Deploy failed')) throw e;
    }
  }
  return fallbackUrl; // Return predicted URL even if polling times out
}

/**
 * Get all deployed sites for current user
 */
export function getDeployedSites() {
  return getSites();
}

/**
 * Delete a Netlify site
 */
export async function deleteDeployedSite(siteId) {
  if (!NETLIFY_TOKEN) return;
  try {
    await fetch(`${NETLIFY_API}/sites/${siteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}` }
    });
    const sites = getSites().filter(s => s.siteId !== siteId);
    saveSites(sites);
    return true;
  } catch { return false; }
}

/**
 * Check if Netlify token is configured
 */
export function isNetlifyConfigured() {
  return !!NETLIFY_TOKEN;
}

// ─── UTILS ──────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sha1(str) {
  const buffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
