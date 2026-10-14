import type { Incident } from './db';
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
