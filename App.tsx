import { useEffect, useMemo, useState } from 'react';
import { all, put, uid, sha256, evidenceFields, verifyEvidence, clearAll, type Role, type Incident, type AlertRec, type Person, type Severity, type Status, type AuditEntry } from './db';
import { loadDemoData } from './demo';
import { toCSV, toPDF, download, policePacket } from './export';
import { getLeague, setLeague, activeBans, type ActiveBan } from './league';
import type { IdInfo } from './db';

const SPORTS = ['Basketball', 'Football', 'Baseball', 'Softball', 'Soccer', 'Volleyball', 'Wrestling', 'Hockey', 'Other'];
const CATEGORIES = ['Verbal abuse', 'Threat', 'Physical contact', 'Thrown object', 'Followed official', 'Entered restricted area', 'Disruptive conduct', 'Other'];
const STATUS_LABEL: Record<Status, string> = { pending: 'Awaiting review', approved: 'Reviewed — confirmed', rejected: 'Reviewed — not confirmed', needs_info: 'More info requested' };
const FILTER_LABEL = { pending: 'Pending', needs_info: 'Needs info', approved: 'Confirmed', rejected: 'Not confirmed', all: 'All' };
const MOCK_LOCATION = 'Demo location 38.0406, -84.5037 (±15 m) — near home bench';
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fmt = (s: string) => new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const audit = (role: Role, action: string, note?: string): AuditEntry => ({ at: new Date().toISOString(), role, action, note });

async function shareText(title: string, text: string) {
  if (navigator.share) { try { await navigator.share({ title, text }); return 'shared'; } catch { return 'cancelled'; } }
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  return 'copied';
}

type Tab = 'report' | 'alert' | 'brief' | 'mine' | 'review' | 'alerts' | 'people' | 'gate' | 'venues' | 'privacy';

export default function App() {
  const [role, setRole] = useState<Role | null>(() => (localStorage.getItem('ft-role') as Role) || null);
  const [accepted, setAccepted] = useState(() => localStorage.getItem('ft-terms') === '1');
  const [tab, setTab] = useState<Tab>('report');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<AlertRec[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [toast, setToast] = useState('');
  const reload = async () => { setIncidents((await all('incidents')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setAlerts((await all('alerts')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setPersons(await all('persons')); };
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); } }, [toast]);
  const pick = (r: Role) => { localStorage.setItem('ft-role', r); setRole(r); setTab(r === 'admin' ? 'review' : 'report'); };

  if (!accepted) return <><DemoBanner /><Privacy onAccept={() => { localStorage.setItem('ft-terms', '1'); setAccepted(true); }} /></>;
  const seed = async () => { await loadDemoData(); await reload(); setToast('Sample demo data loaded (fake)'); };
  if (!role) return (<>
    <DemoBanner />
    <main className="center">
      <Logo />
      <h1>Who's using FanTrac?</h1>
      <p className="muted">Demo role picker — not a real sign-in.</p>
      <button className="btn big" onClick={() => pick('official')}>I'm an Official<small>Ref, umpire, judge</small></button>
      <button className="btn big secondary" onClick={() => pick('admin')}>I'm an Admin<small>School or league safety admin</small></button>
      <button className="btn ghost" onClick={seed}>Load sample demo data</button>
      {toast && <p role="status">{toast}</p>}
    </main>
  </>);
  const pendingCount = incidents.filter(i => i.status === 'pending').length;
  const openAlerts = alerts.filter(a => a.status === 'open').length;
  const tabs: [Tab, string, number?][] = role === 'official'
    ? [['report', 'Report'], ['alert', 'Alert'], ['brief', 'Brief'], ['mine', 'History'], ['privacy', 'Privacy']]
    : [['review', 'Review', pendingCount], ['alerts', 'Alerts', openAlerts], ['people', 'People'], ['gate', 'Gate'], ['venues', 'Venues'], ['privacy', 'Privacy']];
  const ctx = { role, incidents, alerts, persons, reload, setToast, setTab };
  return (
    <div className="app">
      <div className="sticky">
      <header className="top">
        <div className="brand"><Logo small /> FanTrac</div>
        <button className="chip" onClick={() => { localStorage.removeItem('ft-role'); setRole(null); }} aria-label={`Role: ${role}. Switch role`}>{role === 'admin' ? 'Admin' : 'Official'} ▾</button>
      </header>
      <DemoBanner />
      </div>
      <main className="content">
        <div role="status" aria-live="polite" className={toast ? 'toast show' : 'toast'}>{toast}</div>
        {tab === 'report' && <ReportForm {...ctx} />}
        {tab === 'alert' && <AlertPanel {...ctx} />}
        {tab === 'brief' && <Brief {...ctx} />}
        {tab === 'mine' && <History {...ctx} />}
        {tab === 'review' && <Review {...ctx} />}
        {tab === 'alerts' && <AlertsAdmin {...ctx} />}
        {tab === 'people' && <People {...ctx} />}
        {tab === 'gate' && <Gate {...ctx} />}
        {tab === 'venues' && <Venues {...ctx} />}
        {tab === 'privacy' && role === 'admin' && <LeagueSettings setToast={setToast} />}
        {tab === 'privacy' && <Privacy embedded onSeed={seed} onReset={async () => { if (confirm('Erase all FanTrac data on this device?')) { await clearAll(); await reload(); setToast('All local data erased'); } }} />}
      </main>
      <nav className="tabs" aria-label="Sections">
        {tabs.map(([t, l, n]) => <button key={t} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{l}{n ? <span className="badge" aria-label={`${n} waiting`}>{n}</span> : null}</button>)}
      </nav>
    </div>
  );
}

type Ctx = { role: Role; incidents: Incident[]; alerts: AlertRec[]; persons: Person[]; reload: () => Promise<void>; setToast: (s: string) => void; setTab: (t: Tab) => void };

function DemoBanner() { return <div className="demo" role="note">DEMO – fake data only</div>; }

function Logo({ small }: { small?: boolean }) { return <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={small ? 28 : 72} height={small ? 28 : 72} />; }

function Privacy({ onAccept, embedded, onReset, onSeed }: { onAccept?: () => void; embedded?: boolean; onReset?: () => void; onSeed?: () => void }) {
  return (
    <main className={embedded ? '' : 'center narrow'}>
      {!embedded && <Logo />}
      <h1>Privacy &amp; terms</h1>
      <div className="card prose">
        <p><b>FanTrac is a private safety log for game officials and school or league admins.</b> It is a prototype. Data stays on this device only (no server, no account).</p>
        <ul>
          <li><b>Nothing is public.</b> There is no public list and fans cannot be searched by name.</li>
          <li><b>Reports are allegations, not findings.</b> FanTrac says “incident reported”. Never label anyone a criminal or “fanatic”.</li>
          <li><b>Admin review first.</b> No person is flagged until an admin reviews the report.</li>
          <li><b>Bans are made by your school or league</b> under its own process. FanTrac only records the decision and its reference number.</li>
          <li><b>No names needed.</b> Describe what you saw (clothing, section). No face recognition is used.</li>
          <li><b>Evidence is locked.</b> Reports can't be edited after submit; each has a SHA-256 fingerprint and an audit trail.</li>
          <li><b>Emergencies:</b> call 911. Alerts in this demo are simulated.</li>
          <li>Only report what you personally saw, truthfully. False reports may violate league rules and the law. Records about students may be covered by FERPA; follow your district's policy.</li>
        </ul>
      </div>
      {onAccept && <button className="btn big" onClick={onAccept}>I understand — continue</button>}
      {onSeed && <button className="btn secondary" onClick={onSeed}>Load sample demo data</button>}
      {onReset && <button className="btn danger" onClick={onReset}>Erase all data on this device</button>}
    </main>
  );
}

function ReportForm({ role, reload, setToast, setTab }: Ctx) {
  const [f, setF] = useState({ venue: localStorage.getItem('ft-venue') || '', event: '', occurredAt: nowLocal(), sport: 'Basketball', category: CATEGORIES[0], notes: '', personDescription: '', witnesses: '', severity: 'medium' as Severity });
  const [photo, setPhoto] = useState<string>();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const onPhoto = (file?: File) => { if (!file) return; const r = new FileReader(); r.onload = () => setPhoto(String(r.result)); r.readAsDataURL(file); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { witnesses, ...rest } = f;
    const base = { id: uid(), createdAt: new Date().toISOString(), ...rest, ...(witnesses.trim() ? { witnesses: witnesses.trim() } : {}), occurredAt: new Date(f.occurredAt).toISOString(), photo };
    const inc: Incident = { ...base, status: 'pending', evidenceHash: await sha256(evidenceFields(base)), audit: [audit(role, 'Report submitted and locked')] };
    await put('incidents', inc); localStorage.setItem('ft-venue', f.venue);
    await reload(); setToast(`Report #${inc.id} saved — sent for admin review`); setTab(role === 'admin' ? 'review' : 'mine');
  };
  return (
    <form onSubmit={submit} className="stack">
      <h1>Report an incident</h1>
      <p className="muted">Stick to facts you saw. Once submitted, the report is locked as evidence.</p>
      <label>Venue<input required value={f.venue} onChange={set('venue')} placeholder="e.g. Central HS Gym" /></label>
      <label>Event / game<input required value={f.event} onChange={set('event')} placeholder="e.g. Varsity vs. Eastside" /></label>
      <div className="row">
        <label>Date &amp; time<input type="datetime-local" required value={f.occurredAt} onChange={set('occurredAt')} /></label>
        <label>Sport<select value={f.sport} onChange={set('sport')}>{SPORTS.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      <label>What happened<select value={f.category} onChange={set('category')}>{CATEGORIES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Notes<textarea required rows={4} value={f.notes} onChange={set('notes')} placeholder="What was said or done, when, and who saw it." /></label>
      <label>Person description <span className="muted">(optional, no name needed)</span><textarea rows={2} value={f.personDescription} onChange={set('personDescription')} placeholder="e.g. red cap, grey hoodie, section B row 3" /></label>
      <label>Witnesses <span className="muted">(optional)</span><textarea rows={2} value={f.witnesses} onChange={set('witnesses')} placeholder="e.g. Partner official J. Doe, scorer's table" /></label>
      <fieldset><legend>Severity</legend><div className="seg">
        {(['low', 'medium', 'high'] as Severity[]).map(s => <label key={s} className={`segopt sev-${s} ${f.severity === s ? 'on' : ''}`}><input type="radio" name="sev" value={s} checked={f.severity === s} onChange={set('severity')} />{s[0].toUpperCase() + s.slice(1)}</label>)}
      </div></fieldset>
      <label className="file">📷 {photo ? 'Change photo' : 'Add photo (optional)'}<input type="file" accept="image/*" capture="environment" onChange={e => onPhoto(e.target.files?.[0])} /></label>
      {photo && <img className="thumb" src={photo} alt="Attached evidence" />}
      <button className="btn big" type="submit">Submit for admin review</button>
    </form>
  );
}

function AlertPanel({ role, reload, setToast }: Ctx) {
  const [venue, setVenue] = useState(localStorage.getItem('ft-venue') || '');
  const [event, setEvent] = useState('');
  const [last, setLast] = useState<AlertRec | null>(null);
  const [shareState, setShareState] = useState('');
  const send = async (kind: AlertRec['kind']) => {
    if (kind === 'panic' && !confirm('Send PANIC alert to admin and security, share location and start recording?')) return;
    const message = kind === 'panic' ? 'PANIC — official needs immediate help' : kind === 'escort' ? 'Safe escort requested after the game' : 'Official requests admin on court/field now';
    const a: AlertRec = { id: uid(), createdAt: new Date().toISOString(), kind, venue: venue || 'Unknown venue', event, message,
      location: kind !== 'alert' ? MOCK_LOCATION : undefined,
      recording: kind === 'panic' ? `Demo recording started ${new Date().toLocaleTimeString()} (simulated)` : undefined,
      status: 'open', audit: [audit(role, `${kind} sent`, 'Simulated: notified on-site admin' + (kind === 'panic' ? ' and security' : ''))] };
    await put('alerts', a); setLast(a); setShareState(''); await reload(); setToast(kind === 'panic' ? 'Panic alert sent (demo)' : 'Alert sent (demo)');
  };
  const share = async () => { if (!last) return; setShareState(await shareText('FanTrac alert', `FanTrac ${last.kind.toUpperCase()}: ${last.message}. ${last.venue}${last.event ? ' — ' + last.event : ''}. ${fmt(last.createdAt)}.${last.location ? ' ' + last.location : ''}`)); };
  return (
    <div className="stack">
      <h1>Get help now</h1>
      <p className="muted">Demo: alerts, location and recording are simulated. In a real emergency call 911.</p>
      <div className="row"><label>Venue<input value={venue} onChange={e => setVenue(e.target.value)} /></label><label>Event<input value={event} onChange={e => setEvent(e.target.value)} /></label></div>
      <button className="btn panic" onClick={() => send('panic')}>🚨 PANIC<small>Admin + security · location · recording</small></button>
      <button className="btn big warn" onClick={() => send('alert')}>📣 Alert admin<small>Ask on-site admin to come now</small></button>
      <button className="btn big secondary" onClick={() => send('escort')}>🚶 Request safe escort<small>Walk to car after the game</small></button>
      <a className="btn ghost" href="tel:911">📞 Call 911</a>
      {last && <div className="card" data-testid="alert-record">
        <h2>{last.kind === 'panic' ? 'Panic alert sent' : last.kind === 'escort' ? 'Escort requested' : 'Admin alerted'}</h2>
        <p>#{last.id} · {fmt(last.createdAt)}<br />{last.venue}{last.event && ` — ${last.event}`}</p>
        {last.location && <p>📍 {last.location}</p>}
        {last.recording && <p>⏺ {last.recording}</p>}
        <button className="btn" onClick={share}>Text the on-site admin…</button>
        {shareState === 'copied' && <p className="muted">Alert text copied — paste it in a text message.</p>}
      </div>}
    </div>
  );
}

function IncidentCard({ i, children }: { i: Incident; children?: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <article className="card" data-testid="incident">
      <div className="between"><b>Incident reported: {i.category}</b><span className={`pill sev-${i.severity}`}>{i.severity}</span></div>
      <p className="muted">#{i.id} · {fmt(i.occurredAt)} · {i.venue} — {i.event} · {i.sport}</p>
      <p>{i.notes}</p>
      {i.personDescription && <p><span className="muted">Description:</span> {i.personDescription}</p>}
      {i.witnesses && <p><span className="muted">Witnesses:</span> {i.witnesses}</p>}
      {i.photo && <img className="thumb" src={i.photo} alt="Evidence photo" />}
      <p><span className={`pill st-${i.status}`}>{STATUS_LABEL[i.status]}</span>{i.adminNote && <span className="muted"> — {i.adminNote}</span>}</p>
      <details><summary>Evidence &amp; audit trail</summary>
        <p className="mono">🔒 SHA-256 {i.evidenceHash.slice(0, 16)}…</p>
        <button className="btn small" onClick={async () => setOk(await verifyEvidence(i))}>Verify evidence</button>
        {ok !== null && <p role="status">{ok ? '✅ Unchanged since submitted' : '⚠️ Evidence does not match fingerprint'}</p>}
        <ol className="audit">{i.audit.map((a, n) => <li key={n}>{fmt(a.at)} · {a.role} · {a.action}{a.note ? ` — ${a.note}` : ''}</li>)}</ol>
      </details>
      {children}
    </article>
  );
}

function History({ incidents, alerts }: Ctx) {
  return <div className="stack"><h1>My reports</h1>
    {incidents.length === 0 && <p className="muted">No reports yet.</p>}
    {incidents.map(i => <IncidentCard key={i.id} i={i} />)}
    {alerts.length > 0 && <><h2>Alerts sent</h2>{alerts.map(a => <div className="card" key={a.id}>{a.kind.toUpperCase()} · {fmt(a.createdAt)} · {a.venue} · {a.status}</div>)}</>}
  </div>;
}

const venuesOf = (inc: Incident[]) => [...new Set(inc.map(i => i.venue))].sort();

function Brief({ incidents }: Ctx) {
  const confirmed = incidents.filter(i => i.status === 'approved');
  const venues = venuesOf(confirmed);
  const [v, setV] = useState(localStorage.getItem('ft-venue') || venues[0] || '');
  const list = confirmed.filter(i => i.venue.toLowerCase() === v.toLowerCase());
  const cats = Object.entries(list.reduce<Record<string, number>>((m, i) => ((m[i.category] = (m[i.category] || 0) + 1), m), {}));
  return <div className="stack"><h1>Pre-game safety brief</h1>
    <p className="muted">Only admin-reviewed incidents are shown.</p>
    <label>Venue<input list="venues" value={v} onChange={e => setV(e.target.value)} /></label>
    <datalist id="venues">{venues.map(x => <option key={x} value={x} />)}</datalist>
    <div className="card" data-testid="brief">
      <h2>{v || 'Pick a venue'}</h2>
      <p><b>{list.length}</b> reviewed incident{list.length === 1 ? '' : 's'} on record{list.filter(i => i.severity === 'high').length ? ` · ${list.filter(i => i.severity === 'high').length} high severity` : ''}</p>
      {cats.map(([c, n]) => <p key={c}>• {c}: {n}</p>)}
      {list.length === 0 ? <p className="muted">No reviewed incidents here. Have a good game.</p> : <p>Tips: know where the on-site admin is, keep the Alert tab ready, and request an escort if needed.</p>}
    </div>
    {list.slice(0, 5).map(i => <div className="card" key={i.id}>{fmt(i.occurredAt)} · {i.category} · {i.severity}<br /><span className="muted">{i.event}</span></div>)}
  </div>;
}

function Review({ role, incidents, persons, reload, setToast }: Ctx) {
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const list = incidents.filter(i => filter === 'all' || i.status === filter);
  const decide = async (i: Incident, status: Status) => {
    const note = status === 'approved' ? '' : prompt(status === 'rejected' ? 'Reason (shared with reporter)' : 'What info is needed?') ?? '';
    if (status !== 'approved' && !note) return;
    await put('incidents', { ...i, status, adminNote: note || i.adminNote, audit: [...i.audit, audit(role, `Review: ${STATUS_LABEL[status]}`, note)] });
    await reload(); setToast(`#${i.id}: ${STATUS_LABEL[status]}`);
  };
  const link = async (i: Incident, pid: string) => {
    let p: Person | undefined = persons.find(x => x.id === pid);
    if (pid === 'new') p = { id: uid(), label: `Person of concern ${persons.length + 1}`, description: i.personDescription || '(no description)', incidentIds: [], createdAt: new Date().toISOString(), audit: [audit(role, 'Record created from reviewed report', `#${i.id}`)] };
    if (!p) return;
    await put('persons', { ...p, incidentIds: [...new Set([...p.incidentIds, i.id])], audit: [...p.audit, audit(role, `Linked report #${i.id}`)] });
    await put('incidents', { ...i, personId: p.id, audit: [...i.audit, audit(role, `Linked to ${p.label}`)] });
    await reload(); setToast(`Linked to ${p.label}`);
  };
  return <div className="stack"><h1>Review queue</h1>
    <div className="seg" role="group" aria-label="Filter">{(['pending', 'needs_info', 'approved', 'rejected', 'all'] as const).map(s => <button key={s} className={`segopt ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>{FILTER_LABEL[s]}</button>)}</div>
    {list.length === 0 && <p className="muted">Nothing here.</p>}
    {list.map(i => <IncidentCard key={i.id} i={i}>
      {i.status !== 'approved' && i.status !== 'rejected' && <div className="row3">
        <button className="btn small" onClick={() => decide(i, 'approved')}>Approve</button>
        <button className="btn small secondary" onClick={() => decide(i, 'needs_info')}>Request info</button>
        <button className="btn small danger" onClick={() => decide(i, 'rejected')}>Reject</button>
      </div>}
      {i.status === 'approved' && <button className="btn small secondary" onClick={async () => {
        const blob = await policePacket(i, persons.find(p => p.id === i.personId), getLeague().name);
        const file = new File([blob], `fantrac-police-packet-${i.id}.pdf`, { type: 'application/pdf' });
        await put('incidents', { ...i, audit: [...i.audit, audit(role, 'Police report packet generated')] }); await reload();
        if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Incident report packet' }); return; } catch { /* fall back to download */ } }
        download(file.name, file);
      }}>📄 Police report packet (PDF)</button>}
      {i.status === 'approved' && (i.personId ? <p>🔗 {persons.find(p => p.id === i.personId)?.label}</p> :
        <label>Link to person of concern (admins only)<select defaultValue="" onChange={e => e.target.value && link(i, e.target.value)}>
          <option value="">Choose…</option><option value="new">+ New record</option>{persons.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>)}
    </IncidentCard>)}
  </div>;
}

function AlertsAdmin({ role, alerts, reload }: Ctx) {
  return <div className="stack"><h1>Live alerts</h1>
    {alerts.length === 0 && <p className="muted">No alerts.</p>}
    {alerts.map(a => <div className={`card ${a.kind === 'panic' && a.status === 'open' ? 'hot' : ''}`} key={a.id}>
      <b>{a.kind === 'checkin' ? 'CHECK-IN MATCH' : a.kind.toUpperCase()}</b> · {a.message}<p className="muted">{fmt(a.createdAt)} · {a.venue}{a.event && ` — ${a.event}`}</p>
      {a.location && <p>📍 {a.location}</p>}{a.recording && <p>⏺ {a.recording}</p>}
      {a.status === 'open' ? <button className="btn small" onClick={async () => { await put('alerts', { ...a, status: 'acknowledged', audit: [...a.audit, audit(role, 'Acknowledged')] }); await reload(); }}>Acknowledge — on my way</button> : <p className="pill st-approved">Acknowledged</p>}
    </div>)}
  </div>;
}

/** Admin-only ID capture. Decodes the PDF417 barcode on this device; manual entry is the fallback. */
function IdCapture({ value, onChange }: { value: IdInfo | null; onChange: (v: IdInfo | null) => void }) {
  const [consent, setConsent] = useState(!!value);
  const [f, setF] = useState({ firstName: '', lastName: '', dob: '', state: '', idNumber: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async (src: IdInfo['source'], v = f) => {
    if (!v.lastName || !v.idNumber || !v.state) { setMsg('Last name, ID number and state are required.'); return; }
    const { idHash } = await import('./idscan');
    onChange({ firstName: v.firstName.toUpperCase(), lastName: v.lastName.toUpperCase(), dob: v.dob, state: v.state.toUpperCase(), idLast4: v.idNumber.replace(/\W/g, '').slice(-4), idHash: await idHash(v.state, v.idNumber), source: src, consentAt: new Date().toISOString() });
    setF({ ...f, idNumber: '' }); setMsg('');
  };
  const scan = async (file?: File) => {
    if (!file) return; setBusy(true); setMsg('Reading barcode on this device…');
    try {
      const { decodeLicense, parseAamva } = await import('./idscan');
      const text = await decodeLicense(file); const p = text ? parseAamva(text) : null;
      if (!p) { setMsg('Could not read the barcode. Try again in good light, or type it in below.'); return; }
      const v = { firstName: p.firstName, lastName: p.lastName, dob: p.dob, state: p.state, idNumber: p.idNumber };
      setF(v); await save('scan', v);
    } catch { setMsg('Scanner unavailable. Type it in below.'); } finally { setBusy(false); }
  };
  if (value) return <div className="card idcard" data-testid="id-summary">
    <b>ID attached</b> <span className="pill st-approved">{value.source === 'scan' ? 'Scanned' : 'Entered'}</span>
    <p>{value.firstName} {value.lastName} · DOB {value.dob || '—'} · {value.state} ID ••••{value.idLast4}</p>
    <button type="button" className="btn small secondary" onClick={() => onChange(null)}>Remove ID</button></div>;
  return <fieldset className="card stack idcard"><legend>ID (optional, admins only)</legend>
    <p className="muted small" data-testid="id-legal">Only scan an ID when the person hands it to you or under your school or league's written policy. The barcode is read on this device; nothing is sent to any server. Only name, date of birth, state and the last 4 digits of the ID number are kept (plus a one-way fingerprint for check-in matching). Check your state's ID-scanning and privacy laws before real use.</p>
    <label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> I have consent or policy authority to record this ID</label>
    {consent && <>
      <label className="file">{busy ? 'Reading…' : '📷 Scan back of license (PDF417)'}<input type="file" accept="image/*" capture="environment" disabled={busy} aria-label="Scan back of license" onChange={e => scan(e.target.files?.[0])} /></label>
      <p className="muted small">Or type it in:</p>
      <div className="row"><label>First name<input value={f.firstName} onChange={set('firstName')} /></label><label>Last name<input value={f.lastName} onChange={set('lastName')} /></label></div>
      <div className="row"><label>Date of birth<input type="date" value={f.dob} onChange={set('dob')} /></label><label>State<input value={f.state} maxLength={2} onChange={set('state')} placeholder="KY" /></label></div>
      <label>ID number<input value={f.idNumber} onChange={set('idNumber')} autoComplete="off" /></label>
      <button type="button" className="btn small" onClick={() => save('manual')}>Attach ID</button>
    </>}
    {msg && <p role="alert">{msg}</p>}
  </fieldset>;
}

function People({ role, persons, incidents, reload, setToast }: Ctx) {
  const [ids, setIds] = useState<Record<string, IdInfo | null>>({});
  const record = async (p: Person, f: FormData) => {
    const ban = { venue: String(f.get('venue')), until: String(f.get('until')), reference: String(f.get('ref')), approvedAt: new Date().toISOString() };
    const idInfo = ids[p.id] ?? undefined;
    const log = [audit(role, 'League/school ban decision recorded', `Ref ${ban.reference}, ${ban.venue} until ${ban.until}`)];
    if (idInfo) log.push(audit(role, `ID attached (${idInfo.source})`, `${idInfo.state} ••••${idInfo.idLast4}`));
    await put('persons', { ...p, ban, idInfo: idInfo ?? p.idInfo, audit: [...p.audit, ...log] });
    await reload(); setToast('Ban decision recorded');
  };
  const lift = async (p: Person) => { await put('persons', { ...p, ban: undefined, audit: [...p.audit, audit(role, 'Ban lifted / expired')] }); await reload(); };
  return <div className="stack"><h1>Persons of concern</h1>
    <p className="muted">Admins only. Records exist only from reviewed reports. Not public, not searchable by name.</p>
    {persons.length === 0 && <p className="muted">None yet. Approve a report, then link it.</p>}
    {persons.map(p => <article className="card" key={p.id} data-testid="person">
      <div className="between"><b>{p.label}</b>{p.ban && <span className="pill sev-high">Banned by league</span>}</div>
      <p>{p.description}</p><p className="muted">{p.incidentIds.length} linked report(s): {p.incidentIds.map(id => '#' + id).join(', ')} · {incidents.filter(i => p.incidentIds.includes(i.id)).map(i => i.venue).filter((v, n, a) => a.indexOf(v) === n).join(', ')}</p>
      {p.idInfo && <p data-testid="person-id">🪪 {p.idInfo.firstName} {p.idInfo.lastName} · DOB {p.idInfo.dob || '—'} · {p.idInfo.state} ID ••••{p.idInfo.idLast4}</p>}
      {p.ban ? <><p>Ban: {p.ban.venue} until {p.ban.until} · Ref {p.ban.reference}</p><button className="btn small secondary" onClick={() => lift(p)}>Lift ban</button></> :
        <details><summary>Record a ban decision</summary>
          <form className="stack" onSubmit={e => { e.preventDefault(); record(p, new FormData(e.currentTarget)); }}>
            <p className="muted">Only record a ban your school or league already decided through its own process.</p>
            <label>Venue(s)<input name="venue" required placeholder="All district venues" /></label>
            <label>Until<input name="until" type="date" required /></label>
            <label>Decision reference #<input name="ref" required placeholder="e.g. KHSAA-2026-114" /></label>
            <IdCapture value={ids[p.id] ?? null} onChange={v => setIds({ ...ids, [p.id]: v })} />
            <button className="btn small">Save ban decision</button>
          </form></details>}
      <details><summary>Audit trail</summary><ol className="audit">{p.audit.map((a, n) => <li key={n}>{fmt(a.at)} · {a.role} · {a.action}{a.note ? ` — ${a.note}` : ''}</li>)}</ol></details>
    </article>)}
  </div>;
}

function BanHit({ b }: { b: ActiveBan }) {
  return <div className="card hot" data-testid="gate-hit"><b>Possible match: {b.label}</b><p>{b.description}</p>
    <p>Banned at {b.venue} until {b.until} · Ref {b.reference}</p><p className="muted">Source: {b.source}</p></div>;
}

function Gate({ role, persons, reload }: Ctx) {
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<{ hit?: ActiveBan; checked: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const league = getLeague();
  const bans = activeBans(persons, league);
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const hits = words.length ? bans.filter(b => words.every(w => (b.description + ' ' + b.venue + ' ' + b.label).toLowerCase().includes(w))) : [];
  const finish = async (hit: ActiveBan | undefined, checked: string) => {
    setResult({ hit, checked });
    if (hit) {
      await put('alerts', { id: uid(), createdAt: new Date().toISOString(), kind: 'checkin', venue: localStorage.getItem('ft-venue') || 'Gate', event: '', message: `Check-in match: ${hit.label} (ref ${hit.reference}) — staff told not to confront`, status: 'open', audit: [audit(role, 'Check-in match alert created', hit.source)] });
      await reload();
    }
  };
  const checkName = async (e: React.FormEvent) => {
    e.preventDefault();
    const { nameKey } = await import('./idscan');
    const parts = name.trim().split(/\s+/); if (parts.length < 2) { setResult({ checked: 'Enter first and last name' }); return; }
    const key = nameKey(parts[0], parts[parts.length - 1]);
    await finish(bans.find(b => b.idInfo && nameKey(b.idInfo.firstName, b.idInfo.lastName) === key), name);
  };
  const scan = async (file?: File) => {
    if (!file) return; setBusy(true);
    try {
      const { decodeLicense, parseAamva, idHash, nameKey } = await import('./idscan');
      const text = await decodeLicense(file); const p = text ? parseAamva(text) : null;
      if (!p) { setResult({ checked: 'Could not read the ID barcode — type the name instead' }); return; }
      const h = await idHash(p.state, p.idNumber), k = nameKey(p.firstName, p.lastName);
      await finish(bans.find(b => b.idInfo && (b.idInfo.idHash === h || (nameKey(b.idInfo.firstName, b.idInfo.lastName) === k && (!b.idInfo.dob || b.idInfo.dob === p.dob)))), `${p.firstName} ${p.lastName} (${p.state} ••••${p.idNumber.slice(-4)})`);
    } finally { setBusy(false); }
  };
  return <div className="stack"><h1>Gate &amp; check-in</h1>
    <p className="muted">Checks only active, admin-approved bans ({bans.length}){league.share ? ` including bans shared by ${league.name}` : ''}. No face recognition. A match means: call the admin, don't confront.</p>
    <section className="card stack" aria-labelledby="ci"><h2 id="ci">Check-in</h2>
      <label className="file">{busy ? 'Reading…' : '🪪 Scan ID barcode'}<input type="file" accept="image/*" capture="environment" aria-label="Scan ID at check-in" onChange={e => scan(e.target.files?.[0])} /></label>
      <form onSubmit={checkName} className="row"><label>Or type name<input value={name} onChange={e => setName(e.target.value)} placeholder="First Last" /></label><button className="btn" style={{ alignSelf: 'end' }}>Check</button></form>
      {result && (result.hit ? <div className="banned" role="alert" data-testid="checkin-banned"><b>Banned – call admin, do not confront</b><p>{result.checked} · {result.hit.label} · Ref {result.hit.reference} · {result.hit.source}</p><p>Admin alert created.</p></div>
        : <div className="card" data-testid="checkin-clear" role="status">{result.checked.startsWith('Could') || result.checked.startsWith('Enter') ? result.checked : `No active ban for ${result.checked}.`}</div>)}
    </section>
    <h2>Description check</h2>
    <label>Describe who's at the gate<input value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. red cap" /></label>
    {words.length > 0 && (hits.length ? hits.map(b => <BanHit key={b.key} b={b} />) : <div className="card" data-testid="gate-none">No active ban matches.</div>)}
  </div>;
}

function LeagueSettings({ setToast }: { setToast: (s: string) => void }) {
  const [l, setL] = useState(getLeague());
  const upd = (v: typeof l) => { setL(v); setLeague(v); };
  return <section className="card stack" aria-labelledby="lg"><h2 id="lg">League sharing (demo)</h2>
    <label>League or association<input value={l.name} onChange={e => upd({ ...l, name: e.target.value })} /></label>
    <label className="check"><input type="checkbox" checked={l.share} onChange={e => { upd({ ...l, share: e.target.checked }); setToast(e.target.checked ? 'Sharing bans with member schools (simulated)' : 'League sharing off'); }} /> Share bans with member schools</label>
    <p className="muted small">Simulated on this device: when on, your active bans count as shared, and a fake ban from “Demo North HS” appears in Gate &amp; check-in. Only bans already approved through the league's process should be shared.</p>
  </section>;
}


function Venues({ incidents }: Ctx) {
  const [venue, setVenue] = useState('');
  const counts = useMemo(() => venuesOf(incidents).map(v => { const l = incidents.filter(i => i.venue === v && i.status !== 'rejected'); return { v, n: l.length, high: l.filter(i => i.severity === 'high').length }; }).filter(c => c.n > 0).sort((a, b) => b.n - a.n), [incidents]);
  const max = Math.max(1, ...counts.map(c => c.n));
  const rows = incidents.filter(i => !venue || i.venue === venue);
  const name = `fantrac-${(venue || 'all').replace(/\W+/g, '-').toLowerCase()}`;
  return <div className="stack"><h1>Venues</h1>
    <h2>Incident heat list</h2>
    <div className="card">{counts.length === 0 && <p className="muted">No incidents yet.</p>}
      {counts.map(c => <button className="heat" key={c.v} onClick={() => setVenue(c.v)} aria-label={`${c.v}: ${c.n} incidents, ${c.high} high`}>
        <span>{c.v}</span><span className="bar"><span style={{ width: `${(c.n / max) * 100}%`, background: c.high ? '#c62828' : c.n > 1 ? '#e08a00' : '#2f80ed' }} /></span><b>{c.n}</b></button>)}</div>
    <label>History for<select value={venue} onChange={e => setVenue(e.target.value)}><option value="">All venues</option>{venuesOf(incidents).map(v => <option key={v}>{v}</option>)}</select></label>
    <div className="row"><button className="btn" onClick={() => download(`${name}.csv`, new Blob([toCSV(rows)], { type: 'text/csv' }))}>Export CSV</button>
      <button className="btn secondary" onClick={async () => download(`${name}.pdf`, await toPDF(rows, `FanTrac incident history — ${venue || 'All venues'}`))}>Export PDF</button></div>
    {rows.map(i => <div className="card" key={i.id}><b>{i.event}</b> · {fmt(i.occurredAt)}<br />{i.category} · {i.severity} · <span className={`pill st-${i.status}`}>{STATUS_LABEL[i.status]}</span></div>)}
  </div>;
}
