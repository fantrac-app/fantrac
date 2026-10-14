import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function start(page: Page, role: 'Official' | 'Admin') {
  page.on('dialog', d => d.type() === 'prompt' ? d.accept('Need witness names') : d.accept());
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Privacy & terms' })).toBeVisible();
  await expect(page.getByText('Nothing is public.')).toBeVisible();
  await page.getByRole('button', { name: /I understand/ }).click();
  await page.getByRole('button', { name: new RegExp(`I'm an ${role}`) }).click();
}
async function report(page: Page, o: { venue: string; event: string; sev: string; desc?: string; photo?: boolean; cat?: string }) {
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByLabel('Venue').fill(o.venue);
  await page.getByLabel('Event / game').fill(o.event);
  await expect(page.getByLabel('Date & time')).not.toHaveValue('');
  if (o.cat) await page.getByLabel('What happened').selectOption(o.cat);
  await page.getByLabel('Notes').fill('Fan yelled threats at the umpire after the 3rd inning.');
  if (o.desc) await page.getByLabel(/Person description/).fill(o.desc);
  await page.getByText(o.sev, { exact: true }).click();
  if (o.photo) await page.locator('input[type=file]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Submit for admin review' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'sent for admin review' })).toBeVisible();
}
const switchRole = async (page: Page, role: 'Official' | 'Admin') => {
  await page.getByRole('button', { name: /Switch role/ }).click();
  await page.getByRole('button', { name: new RegExp(`I'm an ${role}`) }).click();
};

test('official reports, evidence is locked and verifiable, no public list', async ({ page }) => {
  await start(page, 'Official');
  await report(page, { venue: 'Central HS Gym', event: 'Varsity vs Eastside', sev: 'High', desc: 'red cap grey hoodie', photo: true, cat: 'Threat' });
  const card = page.getByTestId('incident').first();
  await expect(card).toContainText('Incident reported: Threat');
  await expect(card).toContainText('Awaiting review');
  await expect(card.getByAltText('Evidence photo')).toBeVisible();
  await card.getByText('Evidence & audit trail').click();
  await card.getByRole('button', { name: 'Verify evidence' }).click();
  await expect(card).toContainText('Unchanged since submitted');
  // officials cannot see admin-only areas
  await expect(page.getByRole('button', { name: 'People' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gate' })).toHaveCount(0);
  // brief shows nothing until reviewed
  await page.getByRole('button', { name: 'Brief' }).click();
  await expect(page.getByTestId('brief')).toContainText('0 reviewed incidents');
  // persists after reload (IndexedDB)
  await page.reload();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByTestId('incident')).toHaveCount(1);
});

test('alert admin, panic and escort create mocked records', async ({ page, context }) => {
  await start(page, 'Official');
  await page.getByRole('button', { name: 'Alert', exact: true }).click();
  await page.getByRole('textbox', { name: 'Venue' }).fill('Memorial Field');
  await page.getByRole('button', { name: /Alert admin/ }).click();
  await expect(page.getByTestId('alert-record')).toContainText('Admin alerted');
  await expect(page.getByRole('button', { name: /Text the on-site admin/ })).toBeVisible();
  await page.getByRole('button', { name: /PANIC/ }).click();
  await expect(page.getByTestId('alert-record')).toContainText('Panic alert sent');
  await expect(page.getByTestId('alert-record')).toContainText('Demo location');
  await expect(page.getByTestId('alert-record')).toContainText('recording started');
  await page.getByRole('button', { name: /safe escort/ }).click();
  await expect(page.getByTestId('alert-record')).toContainText('Escort requested');
  await switchRole(page, 'Admin');
  await page.getByRole('button', { name: /^Alerts/ }).click();
  await expect(page.getByText('PANIC', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Acknowledge/ }).first().click();
  await expect(page.getByText('Acknowledged').first()).toBeVisible();
});

test('admin review, person link, ban, gate check, brief, heat list and exports', async ({ page }) => {
  await start(page, 'Official');
  await report(page, { venue: 'Central HS Gym', event: 'Game 1', sev: 'High', desc: 'red cap grey hoodie' });
  await report(page, { venue: 'Central HS Gym', event: 'Game 2', sev: 'Low' });
  await report(page, { venue: 'Eastside Field', event: 'Game 3', sev: 'Medium' });
  await switchRole(page, 'Admin');
  await expect(page.getByTestId('incident')).toHaveCount(3);
  const g1 = page.getByTestId('incident').filter({ hasText: 'Game 1' });
  await g1.getByRole('button', { name: 'Approve' }).click();
  const g2 = page.getByTestId('incident').filter({ hasText: 'Game 2' });
  await g2.getByRole('button', { name: 'Request info' }).click();
  await page.getByTestId('incident').filter({ hasText: 'Game 3' }).getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByTestId('incident')).toHaveCount(0); // pending queue empty
  await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
  const ok = page.getByTestId('incident').filter({ hasText: 'Game 1' });
  await ok.getByLabel(/Link to person of concern/).selectOption('new');
  await expect(ok).toContainText('Person of concern 1');
  await ok.getByText('Evidence & audit trail').click();
  await expect(ok.locator('.audit li')).toHaveCount(3);

  // gate: not banned yet → no match
  await page.getByRole('button', { name: 'Gate' }).click();
  await page.getByLabel(/Describe who/).fill('red cap');
  await expect(page.getByTestId('gate-none')).toBeVisible();

  await page.getByRole('button', { name: 'People' }).click();
  const p = page.getByTestId('person');
  await p.getByText('Record a ban decision').click();
  await p.getByLabel('Venue(s)').fill('All district venues');
  await p.getByLabel('Until').fill('2099-01-01');
  await p.getByLabel('Decision reference #').fill('LEAGUE-2026-7');
  await p.getByRole('button', { name: 'Save ban decision' }).click();
  await expect(p).toContainText('Banned by league');

  await page.getByRole('button', { name: 'Gate' }).click();
  await page.getByLabel(/Describe who/).fill('red cap');
  await expect(page.getByTestId('gate-hit')).toContainText('LEAGUE-2026-7');
  await page.getByLabel(/Describe who/).fill('blue jacket');
  await expect(page.getByTestId('gate-none')).toBeVisible();

  await page.getByRole('button', { name: 'Venues' }).click();
  await expect(page.getByRole('button', { name: /Central HS Gym: 2 incidents/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Eastside Field/ })).toHaveCount(0); // rejected excluded
  await page.getByLabel('History for').selectOption('Central HS Gym');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(csv.suggestedFilename()).toBe('fantrac-central-hs-gym.csv');
  const text = readFileSync((await csv.path())!, 'utf8');
  expect(text.split('\n')).toHaveLength(3);
  expect(text).toContain('evidenceHash');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export PDF' }).click()]);
  expect(readFileSync((await pdf.path())!).subarray(0, 4).toString()).toBe('%PDF');

  await switchRole(page, 'Official');
  await page.getByRole('button', { name: 'Brief' }).click();
  await page.getByLabel('Venue').fill('Central HS Gym');
  await expect(page.getByTestId('brief')).toContainText('1 reviewed incident on record · 1 high severity');
});

test('PWA manifest and service worker', async ({ page, request }) => {
  const m = await (await request.get('manifest.webmanifest')).json();
  expect(m.short_name).toBe('FanTrac');
  expect((await request.get('sw.js')).ok()).toBeTruthy();
  await page.goto('./');
  await expect(page.locator('link[rel=manifest]')).toHaveCount(1);
});

test('demo banner and one-tap fake sample data', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('DEMO – fake data only')).toBeVisible();
  await page.getByRole('button', { name: /I understand/ }).click();
  await page.getByRole('button', { name: 'Load sample demo data' }).click();
  await expect(page.getByText('Sample demo data loaded (fake)')).toBeVisible();
  await page.getByRole('button', { name: /I'm an Admin/ }).click();
  await expect(page.getByText('DEMO – fake data only')).toBeVisible();
  await expect(page.getByTestId('incident')).toHaveCount(1);
  await expect(page.getByTestId('incident')).toContainText('fake demo data');
  await page.getByRole('button', { name: 'Gate' }).click();
  await page.getByLabel(/Describe who/).fill('orange cap');
  await expect(page.getByTestId('gate-hit')).toContainText('DEMO-2026-001');
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
  const c = page.getByTestId('incident').first();
  await c.getByText('Evidence & audit trail').click();
  await c.getByRole('button', { name: 'Verify evidence' }).click();
  await expect(c).toContainText('Unchanged since submitted');
});

test('confirmation message does not cover content', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /I understand/ }).click();
  await page.getByRole('button', { name: /I'm an Official/ }).click();
  await page.getByRole('button', { name: 'Alert', exact: true }).click();
  await page.getByRole('button', { name: /Alert admin/ }).click();
  const t = await page.locator('.toast.show').boundingBox();
  for (const sel of ['.btn.panic', '[data-testid=alert-record]']) {
    const b = (await page.locator(sel).boundingBox())!;
    expect(t!.y + t!.height <= b.y || b.y + b.height <= t!.y).toBeTruthy();
  }
  expect(await page.locator('.toast').evaluate(e => getComputedStyle(e).position)).toBe('static');
});
