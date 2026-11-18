// Committed pilot, not workflow inputs. A changed endpoint, code, polygon or policy requires review.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const PILOT = Object.freeze({ legalCode: '1117011900', adminCode: '11170580', boundaryDate: '2026-10-01',
  boundarySha: '352ea8deb9e5d54e945cf2f76c61948c9eef97ae5128b87feb32d0470268312b',
  mapping: 'seoul-hyochang-whole-dong-2026-11-18' });
export const LIMIT = Object.freeze({ buildings: 12, zoning: 8, pageSize: 100, perLayer: 2, bytes: 3 * 1024 * 1024, vertices: 60000, k: 10, minZoneM2: 1000 });
export const LAYERS = Object.freeze(['LT_C_UQ111','LT_C_UQ112','LT_C_UQ113','LT_C_UQ114']);
export const APPROVED_DOMAIN = 'https://cybecho.github.io/airbnb-market-observer/';
export const REPOSITORY = 'Cybecho/airbnb-market-observer';
export const requireThat = (ok) => { if (!ok) throw new Error('Spatial review withheld'); };

// Non-secret attestations: for the *specific* provider, method, public aggregate summary and free budget.
// Values must refer to a reviewed current approval; a key or dispatch by itself is not an approval.
export function gate(kind, env, now = new Date()) {
  requireThat(['buildings','zoning'].includes(kind) && env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_REF === 'refs/heads/main'
    && env.GITHUB_WORKFLOW_REF === `${REPOSITORY}/.github/workflows/authorized-spatial.yml@refs/heads/main`
    && env.PUBLIC_REPO === 'true' && env.GITHUB_RUN_ATTEMPT === '1'
    && env.RUNNER_OS === 'Linux' && env.RUNNER_ENVIRONMENT === 'github-hosted'
    && env.RUNNER_DEBUG !== '1' && env.ACTIONS_STEP_DEBUG !== 'true');
  const day = now.toISOString().slice(0,10), until = env.REVIEW_UNTIL;
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(until || '') && day <= until &&
    new Date(`${until}T00:00:00Z`).toISOString().slice(0,10) === until && Date.parse(until) - Date.parse(day) <= 90 * 86400000);
  requireThat(/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(env.APPROVAL_REFERENCE || ''));
  if (kind === 'zoning') {
    requireThat(env.REGISTERED_DOMAIN === APPROVED_DOMAIN && env.VWORLD_GRANT_SCOPE === 'free-runner-4layers-transform-public-summary');
  }
}

export async function mappedPilot() {
  const file = new URL('../../data/organized/geography/seoul-admin.geojson', import.meta.url);
  const buf = await readFile(file);
  requireThat(createHash('sha256').update(buf).digest('hex') === PILOT.boundarySha);
  const features = JSON.parse(buf).features.filter(f => f.properties.admin_code === PILOT.adminCode);
  requireThat(features.length === 1 && features[0].properties.boundary_date === PILOT.boundaryDate);
  const legal = JSON.parse(await readFile(new URL('../../data/organized/registry/legal-dongs.json',import.meta.url),'utf8'));
  requireThat(legal.filter(d => d.legal_dong_code === PILOT.legalCode).length === 1);
  return features[0].geometry;
}
