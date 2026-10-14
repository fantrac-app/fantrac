import { webkit, devices } from '@playwright/test';
const b = await webkit.launch(); const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage();
p.on('dialog', d => d.accept('Need witness names'));
const U = 'http://127.0.0.1:4321/fantrac/', S = n => p.screenshot({ path: `screenshots/${n}.png` });
await p.goto(U); await S('01-privacy');
await p.getByRole('button', { name: /I understand/ }).click(); await S('02-role-picker');
await p.getByRole('button', { name: /Official/ }).click();
for (const [v, e, sev, d] of [['Central HS Gym', 'Varsity vs Eastside', 'High', 'red cap, grey hoodie, section B'], ['Central HS Gym', 'JV vs Northside', 'Medium', ''], ['Memorial Field', 'U14 Final', 'Low', '']]) {
  await p.getByRole('button', { name: 'Report', exact: true }).click();
  await p.getByLabel('Venue').fill(v); await p.getByLabel('Event / game').fill(e);
  await p.getByLabel('What happened').selectOption('Threat');
  await p.getByLabel('Notes').fill('Spectator shouted threats at the official and followed him toward the locker room.');
  await p.getByLabel(/Person description/).fill(d); await p.getByText(sev, { exact: true }).click();
  if (v === 'Memorial Field') { await p.screenshot({ path: 'screenshots/03-report-form.png', fullPage: true }); }
  await p.getByRole('button', { name: 'Submit for admin review' }).click(); await p.waitForTimeout(300);
}
await p.getByRole('button', { name: 'Alert', exact: true }).click(); await p.getByRole('button', { name: /PANIC/ }).click(); await p.waitForTimeout(300); await S('04-alert-panic');
await p.getByRole('button', { name: /Switch role/ }).click(); await p.getByRole('button', { name: /Admin/ }).click(); await p.waitForTimeout(300); await S('05-admin-review');
for (const n of ['Varsity', 'JV']) await p.getByTestId('incident').filter({ hasText: n }).getByRole('button', { name: 'Approve' }).click();
await p.getByRole('button', { name: 'Confirmed', exact: true }).click();
await p.getByTestId('incident').filter({ hasText: 'Varsity' }).getByLabel(/Link/).selectOption('new');
await p.getByRole('button', { name: 'People' }).click(); await p.getByText('Record a ban decision').click();
await p.getByLabel('Venue(s)').fill('All district venues'); await p.getByLabel('Until').fill('2027-06-01'); await p.getByLabel('Decision reference #').fill('DIST-2026-114');
await p.getByRole('button', { name: 'Save ban decision' }).click(); await p.waitForTimeout(300); await S('06-person-of-concern');
await p.getByRole('button', { name: 'Gate' }).click(); await p.getByLabel(/Describe/).fill('red cap'); await S('07-gate-check');
await p.getByRole('button', { name: 'Venues' }).click(); await S('08-venues-heat-export');
await p.getByRole('button', { name: /Switch role/ }).click(); await p.getByRole('button', { name: /Official/ }).click();
await p.getByRole('button', { name: 'Brief' }).click(); await p.getByLabel('Venue').fill('Central HS Gym'); await S('09-pregame-brief');
await b.close();
