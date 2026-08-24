import assert from 'node:assert/strict';
import { createEmptyCareerProfile, deleteCareerProfile, getCareerProfile, listCareerProfiles, saveCareerProfile } from '../services/CareerProfileService.js';

const ownerA = `local-a-${Date.now()}`;
const ownerB = `local-b-${Date.now()}`;
const profile = createEmptyCareerProfile({ ownerUserId: ownerA, stage: 'student' });
profile.content.contact.name = 'Local Test Student';
profile.content.skills = ['JavaScript'];
saveCareerProfile(profile, ownerA);

assert.equal(getCareerProfile(profile.id, ownerA).content.contact.name, 'Local Test Student');
assert.equal(getCareerProfile(profile.id, ownerB), null, 'profiles must be isolated by owner');
assert.equal(listCareerProfiles(ownerA).length, 1);
assert.throws(() => saveCareerProfile(profile, ownerB), /ownership mismatch/);
assert.equal(deleteCareerProfile(profile.id, ownerA), true);
assert.equal(getCareerProfile(profile.id, ownerA), null);
console.log('CareerProfileLocalTestSuite: passed');

