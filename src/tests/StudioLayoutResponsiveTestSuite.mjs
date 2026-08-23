import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../index.css', import.meta.url), 'utf8');
const checks = [
  ['Desktop editor compaction rules are scoped above tablet/mobile breakpoints', /@media \(min-width: 901px\)[\s\S]*?\.sidebar-header \{ padding: 12px 18px 10px;/.test(css)],
  ['Workspace navigation stays on one compact horizontal row', /\.workspace-nav-list \{[\s\S]*?flex-wrap: nowrap !important;[\s\S]*?overflow-x: auto;/.test(css)],
  ['Workspace buttons use compact spacing on desktop', /\.workspace-nav-list \.ws-btn \{[\s\S]*?padding: 5px 8px !important;/.test(css)],
  ['Workspace description truncates instead of expanding the header', /#workspace-header-area > div > div:first-child > div:last-child \{[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/.test(css)],
  ['Create tabs use compact spacing without disabling horizontal access', /#create-subnav-bar \.tab-btn \{[\s\S]*?padding: 6px 4px;/.test(css) && /\.sidebar-tabs \{ overflow-x: auto;/.test(css)],
  ['Editor content remains the flexible scrollable region', /\.sidebar-content \{[\s\S]*?flex: 1;[\s\S]*?overflow-y: auto;/.test(css)],
  ['Mobile studio layout rules remain present', /@media \(max-width: 900px\)[\s\S]*?\.mobile-studio-switch[\s\S]*?display: grid;/.test(css) && /@media \(max-width: 560px\)[\s\S]*?\.sidebar-header \{ display: none;/.test(css)]
];

for (const [name, passed] of checks) console.log(`${passed ? '✅' : '❌'} ${name}`);
const failed = checks.filter(([, passed]) => !passed);
console.log(`\nStudio responsive layout: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
