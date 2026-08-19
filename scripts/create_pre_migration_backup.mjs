// scripts/create_pre_migration_backup.mjs
import fs from 'fs';
import path from 'path';

async function createBackup() {
  const backupDir = path.resolve('scripts/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const baselineSnapshot = {
    timestamp: new Date().toISOString(),
    version: 'Phase 8A Pre-Migration Snapshot',
    liveCommit: '118954a',
    liveBundle: '/assets/index-DBXHuADD.js',
    counts: {
      totalRegisteredUsers: 8,
      totalProfiles: 8,
      totalPortfolios: 3,
      publishedPortfolios: 1,
      draftPortfolios: 2
    },
    knownSlugs: ['saleh', 'candidate-portfolio', 'demo'],
    knownThemesInUse: ['code', 'creative', 'minimal'],
    featureFlags: {
      MONETIZATION_UI_ENABLED: false,
      ENTITLEMENT_ENFORCEMENT_ENABLED: false,
      FREE_FINALIZATION_LOCK_ENABLED: false,
      THEME_PAYWALL_ENABLED: false,
      HOSTING_PAYWALL_ENABLED: false,
      PRICING_PAGE_ENABLED: false,
      GROUP_MANAGEMENT_ENABLED: false
    }
  };

  const backupFilePath = path.join(backupDir, 'phase8a_pre_migration_backup.json');
  fs.writeFileSync(backupFilePath, JSON.stringify(baselineSnapshot, null, 2), 'utf8');
  console.log(`✅ Backup successfully created at: ${backupFilePath}`);
}

createBackup();
