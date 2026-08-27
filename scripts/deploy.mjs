#!/usr/bin/env node
// Deploy the built plugin artifacts (main.js, styles.css, manifest.json)
// into the Obsidian vault plugin folder so the vault always gets the
// latest CSS (the build itself only regenerates main.js).
//
// Usage:
//   npm run deploy                 # auto-detect the vault, copy artifacts
//   npm run deploy -- --vault <path>   # or point at a specific vault
//   BABYLON_VAULT=<path> npm run deploy

import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = ['main.js', 'styles.css', 'manifest.json'];

function existingArtifacts() {
	return ARTIFACTS.filter((f) => {
		if (!existsSync(join(ROOT, f))) {
			console.warn(`  ! missing build artifact: ${f} (run "npm run build" first)`);
			return false;
		}
		return true;
	});
}

// rough home-relative expansion for common shells
function expand(p) {
	if (p && p.startsWith('~')) return p.replace(/^~/, process.env.HOME || '');
	return p;
}

// look for any .obsidian/plugins/babylon folder under common roots
function detectCandidates() {
	const roots = [
		process.env.HOME,
		process.env.HOME ? join(process.env.HOME, 'Documents', 'Obsidian Vault') : '',
		process.env.HOME ? join(process.env.HOME, 'Obsidian') : '',
	];
	const found = [];
	for (const root of roots) {
		if (!root || !existsSync(root)) continue;
		const walk = (dir) => {
			let entries = [];
			try {
				entries = readdirSync(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const e of entries) {
				if (e.name.startsWith('.') && e.name !== '.obsidian') continue;
				if (e.name === '.obsidian') {
					const plugins = join(dir, '.obsidian', 'plugins');
					if (existsSync(join(plugins, 'babylon'))) found.push(join(plugins, 'babylon'));
					continue;
				}
				if (e.isDirectory()) {
					// don't descend too far or into node_modules
					if (e.name === 'node_modules' || e.name === '.git') continue;
					walk(join(dir, e.name));
				}
			}
		};
		walk(root);
	}
	return found;
}

function chooseTarget() {
	const explicit = process.argv.find((a) => a === '--vault' || a === '--plugin-folder');
	if (explicit) {
		const idx = process.argv.indexOf(explicit);
		const val = process.argv[idx + 1];
		if (val) return join(expand(val), 'babylon');
	}
	if (process.env.BABYLON_VAULT) return join(expand(process.env.BABYLON_VAULT), '.obsidian', 'plugins', 'babylon');
	return null;
}

// if BABYLON_PLUGIN_FOLDER points straight at the plugin folder, use it
if (process.env.BABYLON_PLUGIN_FOLDER) {
	const dest = expand(process.env.BABYLON_PLUGIN_FOLDER);
	const arts = existingArtifacts();
	for (const f of arts) cpSync(join(ROOT, f), join(dest, f), { force: true });
	console.log(`deployed to: ${dest}`);
	for (const f of arts) console.log(`  ${f}`);
	process.exit(0);
}

const chosen = chooseTarget();
const targets = chosen ? [chosen] : detectCandidates();

if (targets.length === 0) {
	console.error(
		[
			'Could not find the plugin folder automatically.',
			'Install with:',
			'',
			'  BABYLON_VAULT=/path/to/vault npm run deploy',
			'  # or directly to the plugin folder:',
			'  BABYLON_PLUGIN_FOLDER=/path/to/vault/.obsidian/plugins/babylon npm run deploy',
		].join('\n'),
	);
	process.exit(1);
}

for (const dest of targets) {
	if (!existsSync(dest)) continue;
	const arts = existingArtifacts();
	for (const f of arts) cpSync(join(ROOT, f), join(dest, f), { force: true });
	console.log(`deployed to: ${dest}`);
	for (const f of arts) console.log(`  ${f}`);
}
