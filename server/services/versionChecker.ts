import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from './logger.js';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string };
const CURRENT_VERSION = pkg.version;

export interface VersionInfo {
  current: string;
  latest: string | null;
  update_available: boolean;
  checked_at: string | null;
}

let cache: VersionInfo = {
  current: CURRENT_VERSION,
  latest: null,
  update_available: false,
  checked_at: null,
};

export function getVersionInfo(): VersionInfo {
  return cache;
}

export async function refreshVersionCheck(): Promise<void> {
  try {
    const res = await fetch('https://api.github.com/repos/sym0nd0/BasicBudget/releases/latest', {
      headers: { 'User-Agent': `BasicBudget/${CURRENT_VERSION}` },
    });
    if (!res.ok) throw new Error(`GitHub API responded with ${res.status}`);
    const data = await res.json() as { tag_name: string };
    const latest = data.tag_name.replace(/^v/, '');
    cache = {
      current: CURRENT_VERSION,
      latest,
      update_available: latest !== CURRENT_VERSION,
      checked_at: new Date().toISOString(),
    };
    logger.info('Version check complete', { current: CURRENT_VERSION, latest, update_available: latest !== CURRENT_VERSION });
  } catch (err) {
    logger.error('Version check failed', { error: err instanceof Error ? err.message : String(err) });
    cache = {
      current: CURRENT_VERSION,
      latest: null,
      update_available: false,
      checked_at: new Date().toISOString(),
    };
  }
}
