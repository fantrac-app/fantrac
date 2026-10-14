import { put, sha256, evidenceFields, type Incident, type Person, type AlertRec, type Severity, type Status } from './db';

/** Fake demo data only — invented venues, events and descriptions. */
export async function loadDemoData() {
  const day = 864e5, now = Date.now();
  const rows: [string, string, string, string, string, Severity, Status, string, number][] = [
    ['Demo Valley HS Gym', 'DEMO Varsity vs Sample Prep', 'Basketball', 'Threat', 'Spectator shouted a threat at the referee during the 4th quarter. (fake demo data)', 'high', 'approved', 'orange cap, green jacket, bleacher row 2', 3],
    ['Demo Valley HS Gym', 'DEMO JV vs Testville', 'Basketball', 'Verbal abuse', 'Repeated insults toward the officials after a foul call. (fake demo data)', 'medium', 'approved', 'orange cap, green jacket', 10],
    ['Example Park Field 2', 'DEMO U14 Final', 'Baseball', 'Thrown object', 'Water bottle thrown toward the plate umpire. (fake demo data)', 'high', 'pending', 'striped shirt, near 1st base fence', 1],
    ['Example Park Field 2', 'DEMO U12 Semifinal', 'Baseball', 'Followed official', 'Adult followed umpire toward parking lot after the game. (fake demo data)', 'medium', 'needs_info', '', 6],
    ['Sample Stadium', 'DEMO Homecoming Game', 'Football', 'Disruptive conduct', 'Loud disruptive conduct near the team bench. (fake demo data)', 'low', 'rejected', '', 14],
  ];
  const incidents: Incident[] = [];
  for (const [n, [venue, event, sport, category, notes, severity, status, personDescription, ago]] of rows.entries()) {
    const t = new Date(now - ago * day).toISOString();
    const base = { id: `DEMO${n + 1}`, createdAt: t, occurredAt: t, venue, event, sport, category, notes, personDescription, severity };
    const inc: Incident = { ...base, status, evidenceHash: await sha256(evidenceFields(base)), audit: [{ at: t, role: 'official', action: 'Report submitted and locked' }] };
    if (status !== 'pending') inc.audit.push({ at: t, role: 'admin', action: `Review: ${status}`, note: status === 'needs_info' ? 'Any witnesses?' : status === 'rejected' ? 'Not enough detail' : undefined });
    incidents.push(inc);
  }
  const person: Person = { id: 'DEMOP1', label: 'Person of concern (demo)', description: 'orange cap, green jacket (fake demo data)', incidentIds: ['DEMO1', 'DEMO2'], createdAt: incidents[1].createdAt,
    ban: { venue: 'All Demo District venues', until: new Date(now + 180 * day).toISOString().slice(0, 10), reference: 'DEMO-2026-001', approvedAt: incidents[0].createdAt },
    audit: [{ at: incidents[1].createdAt, role: 'admin', action: 'Record created from reviewed report', note: '#DEMO2' }, { at: incidents[0].createdAt, role: 'admin', action: 'League/school ban decision recorded', note: 'Ref DEMO-2026-001' }] };
  incidents[0].personId = incidents[1].personId = person.id;
  const alert: AlertRec = { id: 'DEMOA1', createdAt: new Date(now - 36e5).toISOString(), kind: 'escort', venue: 'Example Park Field 2', event: 'DEMO U14 Final', message: 'Safe escort requested after the game', location: 'Demo location (simulated)', status: 'open', audit: [] };
  for (const i of incidents) await put('incidents', i);
  await put('persons', person); await put('alerts', alert);
}
