// League-shared bans — SIMULATED on one device for the demo. Fake data only.
import type { Person, IdInfo } from './db';

export interface League { name: string; share: boolean }
export const getLeague = (): League => ({ name: localStorage.getItem('ft-league') || 'Demo Valley Athletic Conference', share: localStorage.getItem('ft-league-share') === '1' });
export const setLeague = (l: League) => { localStorage.setItem('ft-league', l.name); localStorage.setItem('ft-league-share', l.share ? '1' : '0'); };

export interface ActiveBan { key: string; label: string; source: string; description: string; venue: string; until: string; reference: string; idInfo?: IdInfo }

/** Bans other member schools have shared through the league (simulated, fake). */
const SHARED: ActiveBan[] = [{
  key: 'SHARED1', label: 'Shared person of concern (demo)', source: 'Demo North HS (league share)',
  description: 'blue windbreaker, white sneakers (fake demo data)', venue: 'All conference venues', until: '2099-12-31', reference: 'DVAC-DEMO-042',
  idInfo: { firstName: 'TEST', lastName: 'PERSON', dob: '1985-05-05', state: 'ZZ', idLast4: '9999', idHash: '', source: 'manual', consentAt: '2026-01-01T00:00:00.000Z' },
}];

export function activeBans(persons: Person[], league = getLeague()): ActiveBan[] {
  const today = new Date().toISOString().slice(0, 10);
  const own = persons.filter(p => p.ban && p.ban.until >= today).map(p => ({ key: p.id, label: p.label, source: 'This school', description: p.description, venue: p.ban!.venue, until: p.ban!.until, reference: p.ban!.reference, idInfo: p.idInfo }));
  return league.share ? [...own, ...SHARED.filter(b => b.until >= today)] : own;
}
