// On-device PDF417 (driver-license back) decoding. The .wasm is bundled with the app; nothing is sent to any server.
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { sha256 } from './db';

prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });

export interface ParsedId { firstName: string; lastName: string; dob: string; state: string; idNumber: string }

export async function decodeLicense(file: Blob): Promise<string | null> {
  const res = await readBarcodes(file, { formats: ['PDF417'], tryHarder: true, tryRotate: true, maxNumberOfSymbols: 1, textMode: 'Plain' });
  return res.find(r => r.isValid)?.text ?? null;
}

const fmtDate = (v: string) => {
  if (!/^\d{8}$/.test(v)) return v;
  // US: MMDDCCYY. Canada: CCYYMMDD.
  return Number(v.slice(0, 4)) > 1900 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : `${v.slice(4)}-${v.slice(0, 2)}-${v.slice(2, 4)}`;
};

/** Parses the AAMVA data elements we need. Everything else in the barcode is discarded. */
export function parseAamva(text: string): ParsedId | null {
  if (!/ANSI ?\d{6}|AAMVA/.test(text)) return null;
  const f: Record<string, string> = {};
  for (const line of text.split(/[\n\r\x1e]+|<LF>|<CR>|<RS>/)) {
    const m = line.match(/(?:^|DL|ID)(D[A-Z]{2})(.*)$/);
    if (m && !(m[1] in f)) f[m[1]] = m[2].trim();
  }
  let first = f.DAC || '', last = f.DCS || '';
  if (!first && f.DCT) first = f.DCT.split(/[ ,]/)[0];
  if (!last && f.DAA) { const [l, fi] = f.DAA.split(','); last = l; first = first || (fi || '').trim(); }
  const r = { firstName: first, lastName: last, dob: fmtDate(f.DBB || ''), state: f.DAJ || '', idNumber: f.DAQ || '' };
  return r.lastName || r.idNumber ? r : null;
}

export const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const idHash = (state: string, idNumber: string) => sha256(`${norm(state)}|${norm(idNumber)}`);
export const nameKey = (first: string, last: string) => `${norm(first)}|${norm(last)}`;
