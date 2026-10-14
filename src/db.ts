import { openDB, type DBSchema } from 'idb';

export type Role = 'official' | 'admin';
export type Status = 'pending' | 'approved' | 'rejected' | 'needs_info';
export type Severity = 'low' | 'medium' | 'high';
export interface AuditEntry { at: string; role: Role; action: string; note?: string }
export interface Incident {
  id: string; createdAt: string; occurredAt: string; venue: string; event: string; sport: string;
  category: string; notes: string; personDescription: string; witnesses?: string; photo?: string; severity: Severity;
  status: Status; adminNote?: string; personId?: string; evidenceHash: string; audit: AuditEntry[];
}
export interface AlertRec {
  id: string; createdAt: string; kind: 'alert' | 'panic' | 'escort' | 'checkin'; venue: string; event: string;
  message: string; location?: string; recording?: string; status: 'open' | 'acknowledged'; audit: AuditEntry[];
}
export interface IdInfo { firstName: string; lastName: string; dob: string; state: string; idLast4: string; idHash: string; source: 'scan' | 'manual'; consentAt: string }
export interface Person {
  id: string; label: string; description: string; incidentIds: string[]; createdAt: string;
  idInfo?: IdInfo;
  ban?: { venue: string; until: string; reference: string; approvedAt: string };
  audit: AuditEntry[];
}
interface FT extends DBSchema {
  incidents: { key: string; value: Incident };
  alerts: { key: string; value: AlertRec };
  persons: { key: string; value: Person };
}
const dbp = openDB<FT>('fantrac', 1, {
  upgrade(db) { db.createObjectStore('incidents', { keyPath: 'id' }); db.createObjectStore('alerts', { keyPath: 'id' }); db.createObjectStore('persons', { keyPath: 'id' }); }
});
export const uid = () => (crypto.randomUUID?.() ?? String(Date.now() + Math.random())).slice(0, 8).toUpperCase();
export const all = async <K extends 'incidents' | 'alerts' | 'persons'>(s: K) => (await dbp).getAll(s) as Promise<FT[K]['value'][]>;
export const put = async <K extends 'incidents' | 'alerts' | 'persons'>(s: K, v: FT[K]['value']) => (await dbp).put(s, v as never);
export const clearAll = async () => { const d = await dbp; await Promise.all(['incidents', 'alerts', 'persons'].map(s => d.clear(s as 'incidents'))); };

/** The fields that make up the original, locked evidence. Never changed after submit. */
export const evidenceFields = (i: Pick<Incident, 'id' | 'createdAt' | 'occurredAt' | 'venue' | 'event' | 'sport' | 'category' | 'notes' | 'personDescription' | 'photo' | 'severity' | 'witnesses'>) =>
  JSON.stringify([i.id, i.createdAt, i.occurredAt, i.venue, i.event, i.sport, i.category, i.notes, i.personDescription, i.photo ?? '', i.severity, ...(i.witnesses ? [i.witnesses] : [])]);
export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const verifyEvidence = async (i: Incident) => (await sha256(evidenceFields(i))) === i.evidenceHash;
