// Screenshots of the ID scan, check-in, police packet and league screens. Needs `npm run preview` running.
import { webkit, devices } from '@playwright/test';
import { copyFileSync } from 'fs';
const b = await webkit.launch();
try {
  const c = await b.newContext({ ...devices['iPhone 14'], acceptDownloads: true }); const p = await c.newPage();
  p.on('dialog', d => d.accept());
  const S = n => p.screenshot({ path: `screenshots/${n}.png` });
  await p.goto('http://127.0.0.1:4321/fantrac/');
  await p.getByRole('button', { name: /I understand/ }).click();
  await p.getByRole('button', { name: 'Load sample demo data' }).click();
  await p.getByRole('button', { name: /I'm an Admin/ }).click();
  // new person from an approved demo report, to show the ID scan in the ban form
  await p.getByRole('button', { name: 'Confirmed', exact: true }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('incident').filter({ hasText: '#DEMO1' }).getByRole('button', { name: /Police report packet/ }).click()]);
  await dl.saveAs('screenshots/13-police-packet.pdf');
  await p.getByRole('button', { name: 'Pending', exact: true }).click();
  await p.getByTestId('incident').first().getByRole('button', { name: 'Approve' }).click();
  await p.getByRole('button', { name: 'Confirmed', exact: true }).click();
  await p.getByTestId('incident').filter({ hasText: '#DEMO3' }).getByLabel(/Link to person/).selectOption('new');
  await p.getByRole('button', { name: 'People' }).click();
  const person = p.getByTestId('person').filter({ hasText: 'Person of concern 2' });
  await person.getByText('Record a ban decision').click();
  await person.getByLabel(/consent or policy authority/).check();
  await person.getByTestId('id-legal').scrollIntoViewIfNeeded(); await S('10-id-scan-consent');
  await person.getByLabel('Scan back of license').setInputFiles('tests/fixtures/fake-license-pdf417.png');
  await person.getByTestId('id-summary').waitFor(); await person.getByTestId('id-summary').scrollIntoViewIfNeeded(); await S('11-id-scanned');
  await p.getByRole('button', { name: 'Gate' }).click();
  await p.getByLabel('Scan ID at check-in').setInputFiles('tests/fixtures/fake-license-pdf417.png');
  await p.getByTestId('checkin-banned').waitFor(); await S('12-checkin-banned');
  await p.getByRole('button', { name: 'Privacy' }).click();
  await p.getByLabel('Share bans with member schools').check(); await S('14-league-sharing');
  await p.getByRole('button', { name: 'Gate' }).click();
  await p.getByLabel(/Describe who/).fill('blue windbreaker'); await p.getByTestId('gate-hit').scrollIntoViewIfNeeded(); await S('15-gate-league-shared');
} finally { await b.close(); }
