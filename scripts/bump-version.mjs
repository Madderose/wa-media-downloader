#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const manifestPath = path.join(rootDir, 'manifest.json');
const packagePath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allowEmpty = args.includes('--allow-empty');
const bumpType = args.find(arg => !arg.startsWith('--'));

if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Usage: node scripts/bump-version.mjs <major|minor|patch> [--dry-run] [--allow-empty]');
  process.exit(1);
}

// 1. Read current version from package.json or manifest.json
let currentVersion = '1.3.0';
let pkg = null;
if (fs.existsSync(packagePath)) {
  pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  currentVersion = pkg.version || currentVersion;
} else if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  currentVersion = manifest.version || currentVersion;
}

// Parse semver (e.g. 1.3 or 1.3.0)
let [major, minor, patch] = currentVersion.split('.').map(n => parseInt(n, 10) || 0);
if (patch === undefined) patch = 0;

if (bumpType === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpType === 'minor') {
  minor += 1;
  patch = 0;
} else if (bumpType === 'patch') {
  patch += 1;
}

const nextVersion = `${major}.${minor}.${patch}`;
const nextManifestVersion = patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
const today = new Date().toISOString().split('T')[0];

console.log(`Bumping version: ${currentVersion} -> ${nextVersion} (${bumpType}) [Date: ${today}]`);

// 2. Process CHANGELOG.md
if (!fs.existsSync(changelogPath)) {
  console.error(`Erreur: ${changelogPath} introuvable.`);
  process.exit(1);
}

const changelog = fs.readFileSync(changelogPath, 'utf8');
const uncommittedRegex = /##\s*\[Uncommitted\]\s*([\s\S]*?)(?=\n##\s*\[|\Z)/i;
const match = changelog.match(uncommittedRegex);

if (!match) {
  console.error('Erreur: Section ## [Uncommitted] introuvable dans CHANGELOG.md.');
  process.exit(1);
}

const uncommittedContent = match[1].trim();
if (!uncommittedContent && !allowEmpty) {
  console.error('Erreur: La section ## [Uncommitted] est vide. Remplissez vos modifications dans CHANGELOG.md ou utilisez --allow-empty.');
  process.exit(1);
}

const newChangelogSection = `## [Uncommitted]\n\n## [${nextVersion}] - ${today}\n${uncommittedContent ? uncommittedContent + '\n' : ''}`;
const updatedChangelog = changelog.replace(uncommittedRegex, newChangelogSection);

if (dryRun) {
  console.log('\n--- DRY RUN (Aucune modification enregistrée) ---');
  console.log(`- manifest.json: version -> "${nextManifestVersion}"`);
  if (pkg) console.log(`- package.json: version -> "${nextVersion}"`);
  console.log(`- CHANGELOG.md: [Uncommitted] renommé en [${nextVersion}] - ${today}`);
  process.exit(0);
}

// 3. Update manifest.json
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = nextManifestVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✓ Mis à jour ${manifestPath} (version: ${nextManifestVersion})`);
}

// 4. Update package.json
if (pkg) {
  pkg.version = nextVersion;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Mis à jour ${packagePath} (version: ${nextVersion})`);
}

// 5. Update CHANGELOG.md
fs.writeFileSync(changelogPath, updatedChangelog);
console.log(`✓ Mis à jour ${changelogPath}`);

console.log(`\nVersion passée avec succès à ${nextVersion} !`);
