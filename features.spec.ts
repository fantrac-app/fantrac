import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

const BARCODE = 'tests/fixtures/fake-license-pdf417.png'; // FAKE AAMVA data: DEMO SAMPLE, ZZ00001234, DOB 1990-01-01

async function start(page: Page, role: 'Official' | 'Admin', demo = false) {
  page.on('dialog', d => d.accept());
  await page.goto('./');
  await page.getByRole('button', { name: /I understand/ }).click();
  if (demo) { await page.getByRole('button', { name: 'Load sample demo data' }).click(); await expect(page.getByText('Sample demo data loaded')).toBeVisible(); }
  await page.getByRole('button', { name: new RegExp(`I'm an ${role}`) }).click();
}
async function makePerson(page: Page) {
  // Official reports, admin approves and links a person of concern
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByLabel('Venue').fill('Test Gym'); await page.getByLabel('Event / game').fill('Test Game');
  await page.getByLabel('Notes').fill('Threat at the referee.');
  await page.getByLabel(/Witnesses/).fill('Partner ref Q. Tester');
  await page.getByRole('button', { name: 'Submit for admin review' }).click();
  await page.getByRole('button', { name: /Switch role/ }).click();
  await page.getByRole('button', { name: /I'm an Admin/ }).click();
  const c = page.getByTestId('incident').first();
  await expect(c).toContainText('Witnesses: Partner ref Q. Tester');
  await c.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
  await page.getByTestId('incident').first().getByLabel(/Link to person/).selectOption('new');
  await page.getByRole('button', { name: 'People' }).click();
  const p = page.getByTestId('person');
  await p.getByText('Record a ban decision').click();
  await p.getByLabel('Venue(s)').fill('All test venues'); await p.getByLabel('Until').fill('2099-01-01'); await p.getByLabel('Decision reference #').fill('TEST-1');
  await expect(p.getByTestId('id-legal')).toContainText('nothing is sent to any server');
  await p.getByLabel(/consent or policy authority/).check();
  return p;
}

test('admin scans fake license barcode on device when recording a ban', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await start(page, 'Official');
  const p = await makePerson(page);
  await p.getByLabel('Scan back of license').setInputFiles(BARCODE);
  await expect(p.getByTestId('id-summary')).toContainText('DEMO SAMPLE · DOB 1990-01-01 · ZZ ID ••••1234', { timeout: 20000 });
  await expect(p.getByTestId('id-summary')).not.toContainText('ZZ00001234');
  await p.getByRole('button', { name: 'Save ban decision' }).click();
  await expect(p.getByTestId('person-id')).toContainText('••••1234');
  expect(external).toEqual([]);
  // check-in by scanning the same fake ID → banned + admin alert
  await page.getByRole('button', { name: 'Gate' }).click();
  await page.getByLabel('Scan ID at check-in').setInputFiles(BARCODE);
  await expect(page.getByTestId('checkin-banned')).toContainText('Banned – call admin, do not confront', { timeout: 20000 });
  await page.getByRole('button', { name: /^Alerts/ }).click();
  await expect(page.getByText('CHECK-IN MATCH')).toBeVisible();
});

test('manual ID entry fallback and check-in by typed name', async ({ page }) => {
  await start(page, 'Official');
  const p = await makePerson(page);
  await p.getByLabel('First name').fill('Fake'); await p.getByLabel('Last name').fill('Tester');
  await p.getByLabel('Date of birth').fill('1980-02-03'); await p.getByLabel('State').fill('zz'); await p.getByLabel('ID number').fill('X-555-0042');
  await p.getByRole('button', { name: 'Attach ID' }).click();
  await expect(p.getByTestId('id-summary')).toContainText('FAKE TESTER · DOB 1980-02-03 · ZZ ID ••••0042');
  await p.getByRole('button', { name: 'Save ban decision' }).click();
  await p.getByText('Audit trail').last().click();
  await expect(p).toContainText('ID attached (manual)');
  await page.getByRole('button', { name: 'Gate' }).click();
  await page.getByLabel('Or type name').fill('Someone Else'); await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('checkin-clear')).toContainText('No active ban');
  await page.getByLabel('Or type name').fill('fake tester'); await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('checkin-banned')).toContainText('Banned – call admin, do not confront');
  await expect(page.getByRole('button', { name: /Alerts.*1 waiting/ })).toBeVisible();
});

test('police report packet PDF from an approved incident', async ({ page }) => {
  await start(page, 'Admin', true);
  await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
  const c = page.getByTestId('incident').filter({ hasText: '#DEMO1' });
  await expect(c).toContainText('Witnesses:');
  const [dl] = await Promise.all([page.waitForEvent('download'), c.getByRole('button', { name: /Police report packet/ }).click()]);
  expect(dl.suggestedFilename()).toBe('fantrac-police-packet-DEMO1.pdf');
  const pdf = readFileSync((await dl.path())!).toString('latin1');
  expect(pdf.startsWith('%PDF')).toBeTruthy();
  for (const s of ['Incident Report Packet', 'DEMO1', 'Demo Valley HS Gym', 'SHA-256', 'Partner official', 'ID ending 1234', 'DEMO-2026-001', 'Audit trail', 'FAKE DATA ONLY']) expect(pdf).toContain(s);
  await c.getByText('Evidence & audit trail').click();
  await expect(c).toContainText('Police report packet generated');
  // pending reports have no packet button
  await page.getByRole('button', { name: 'Pending', exact: true }).click();
  await expect(page.getByRole('button', { name: /Police report packet/ })).toHaveCount(0);
});

test('league-shared bans appear at gate and check-in only when sharing is on', async ({ page }) => {
  await start(page, 'Admin', true);
  await page.getByRole('button', { name: 'Gate' }).click();
  await page.getByLabel(/Describe who/).fill('blue windbreaker');
  await expect(page.getByTestId('gate-none')).toBeVisible();
  await page.getByRole('button', { name: 'Privacy' }).click();
  await page.getByLabel('League or association').fill('Demo County League');
  await page.getByLabel('Share bans with member schools').check();
  await page.getByRole('button', { name: 'Gate' }).click();
  await expect(page.getByText(/including bans shared by Demo County League/)).toBeVisible();
  await page.getByLabel(/Describe who/).fill('blue windbreaker');
  await expect(page.getByTestId('gate-hit')).toContainText('Demo North HS (league share)');
  await page.getByLabel('Or type name').fill('Test Person'); await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('checkin-banned')).toContainText('DVAC-DEMO-042');
  await page.getByRole('button', { name: 'Privacy' }).click();
  await page.getByLabel('Share bans with member schools').uncheck();
  await page.getByRole('button', { name: 'Gate' }).click();
  await page.getByLabel('Or type name').fill('Test Person'); await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByTestId('checkin-clear')).toBeVisible();
});

test('official cannot reach ID, check-in or league tools', async ({ page }) => {
  await start(page, 'Official', true);
  for (const n of ['People', 'Gate']) await expect(page.getByRole('button', { name: n, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Privacy' }).click();
  await expect(page.getByLabel('Share bans with member schools')).toHaveCount(0);
});
