import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version: CURRENT_VERSION } = require('../../package.json') as { version: string };

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
  // Skip re-fetch if cache is less than 24 hours old
  if (cache.checked_at) {
    const age = Date.now() - new Date(cache.checked_at).getTime();
    if (age < 24 * 60 * 60 * 1000) return;
  }

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
  } catch {
    cache = {
      current: CURRENT_VERSION,
      latest: null,
      update_available: false,
      checked_at: new Date().toISOString(),
    };
  }
}
