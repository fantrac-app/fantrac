import type { Incident, Person } from './db';
const cols: (keyof Incident)[] = ['id', 'occurredAt', 'venue', 'event', 'sport', 'category', 'severity', 'status', 'notes', 'personDescription', 'personId', 'evidenceHash'];
const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
export const toCSV = (rows: Incident[]) => [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
export function download(name: string, blob: Blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function toPDF(rows: Incident[], title: string) {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'pt', format: 'letter' }); let y = 50;
  d.setFontSize(16); d.text(title, 40, y); y += 18; d.setFontSize(9);
  d.text(`Exported ${new Date().toLocaleString()} — CONFIDENTIAL. Reports describe incidents reported, not findings of fact.`, 40, y); y += 22;
  for (const r of rows) {
    const lines = d.splitTextToSize(`#${r.id} | ${new Date(r.occurredAt).toLocaleString()} | ${r.venue} — ${r.event} (${r.sport})\nIncident reported: ${r.category} | Severity: ${r.severity} | Review: ${r.status}\nNotes: ${r.notes || '—'}\nEvidence SHA-256: ${r.evidenceHash}`, 530);
    if (y + lines.length * 12 > 750) { d.addPage(); y = 50; }
    d.text(lines, 40, y); y += lines.length * 12 + 10;
  }
  return d.output('blob');
}

/** Police / SRO packet. Built on the device; the user decides whether to share or download it. */
export async function policePacket(i: Incident, person: Person | undefined, league: string) {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'pt', format: 'letter' }); let y = 48;
  const line = (t: string, size = 10, bold = false) => {
    d.setFont('helvetica', bold ? 'bold' : 'normal'); d.setFontSize(size);
    for (const l of d.splitTextToSize(t, 530) as string[]) { if (y > 750) { d.addPage(); y = 48; } d.text(l, 40, y); y += size + 4; }
  };
  const head = (t: string) => { y += 8; line(t, 12, true); };
  line('DEMO – FAKE DATA ONLY', 9, true);
  line('Incident Report Packet', 18, true);
  line(`Prepared ${new Date().toLocaleString()} for law enforcement / school resource officer. ${league}.`, 9);
  line('This packet records an incident REPORTED by an official and reviewed by an admin. It is not a finding of guilt.', 9);
  head('Incident');
  line(`Report #: ${i.id}`); line(`Date & time: ${new Date(i.occurredAt).toLocaleString()}`); line(`Place: ${i.venue} — ${i.event} (${i.sport})`);
  line(`Incident reported: ${i.category}   Severity: ${i.severity}   Review status: ${i.status}`);
  line(`Narrative: ${i.notes}`); line(`Person description: ${i.personDescription || '—'}`); line(`Witnesses: ${i.witnesses || '—'}`);
  head('Evidence integrity');
  line(`SHA-256 fingerprint: ${i.evidenceHash}`, 9); line('Report was locked at submission and cannot be edited in the app.', 9);
  if (i.photo) { head('Photo'); try { const p = d.getImageProperties(i.photo); const w = Math.min(300, p.width), h = (p.height / p.width) * w; if (y + h > 750) { d.addPage(); y = 48; } d.addImage(i.photo, p.fileType, 40, y, w, h); y += h + 8; } catch { line('(photo could not be embedded)'); } }
  head('Linked person of concern');
  if (person) {
    line(`${person.label} — ${person.description}`);
    if (person.idInfo) line(`ID summary: ${person.idInfo.firstName} ${person.idInfo.lastName}, DOB ${person.idInfo.dob}, ${person.idInfo.state} ID ending ${person.idInfo.idLast4} (${person.idInfo.source === 'scan' ? 'scanned on device' : 'entered by hand'})`);
    if (person.ban) line(`Ban decision: ${person.ban.venue} until ${person.ban.until}, ref ${person.ban.reference}`);
  } else line('None linked.');
  head('Audit trail');
  for (const a of i.audit) line(`${new Date(a.at).toLocaleString()} · ${a.role} · ${a.action}${a.note ? ' — ' + a.note : ''}`, 9);
  return d.output('blob');
}
