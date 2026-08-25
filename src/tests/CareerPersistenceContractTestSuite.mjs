import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const service = await fs.readFile(new URL('../services/CareerProfileService.js', import.meta.url), 'utf8');
const auth = await fs.readFile(new URL('../services/AuthService.js', import.meta.url), 'utf8');
const main = await fs.readFile(new URL('../main.js', import.meta.url), 'utf8');

assert.match(service, /hydrateCareerProfiles/);
assert.match(service, /from\('career_profiles'\)/);
assert.match(service, /from\('career_documents'\)/);
assert.match(service, /serverProfiles/);
assert.match(service, /writeQueues/);
assert.doesNotMatch(auth, /wipeAllUserCaches\(\)/, 'logout must not wipe server-owned CV caches');
assert.match(main, /await hydrateCareerProfiles\(cvUser\.id\)/);
assert.match(main, /await fetchUserProfileAndEntitlements\(cvUser\)/);
console.log('CareerPersistenceContractTestSuite: passed');
