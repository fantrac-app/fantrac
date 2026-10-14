// Generates a FAKE AAMVA driver-license PDF417 barcode for tests/demo. Not a real person.
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer';
import { readFileSync, writeFileSync } from 'fs';
prepareZXingModule({ overrides: { wasmBinary: readFileSync('node_modules/zxing-wasm/dist/writer/zxing_writer.wasm') }, fireImmediately: true });
const LF = '\n', RS = '\x1e', CR = '\r';
const body = ['DAQZZ00001234', 'DCSSAMPLE', 'DACDEMO', 'DADFAKE', 'DBB01011990', 'DAJZZ', 'DBA01012030'].join(LF);
const data = `@${LF}${RS}${CR}ANSI 636000090001DL00310100DL${body}${CR}`;
const r = await writeBarcode(data, { format: 'PDF417', scale: 3 });
if (r.error) throw new Error(r.error);
writeFileSync('tests/fixtures/fake-license-pdf417.png', Buffer.from(await r.image.arrayBuffer()));
console.log('ok', r.image.size);
