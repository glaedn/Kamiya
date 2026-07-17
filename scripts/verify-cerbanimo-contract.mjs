import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const snapshot = JSON.parse(await readFile(new URL('../shared/generated/cerbanimo-contract.json', import.meta.url), 'utf8'));
if (snapshot.contractVersion !== '1.0.0') throw new Error(`Unsupported Cerbanimo contract ${snapshot.contractVersion}`);
const required = ['CanonicalTask','TaskAutomation','EvidenceItem','EvidenceBundle','ValidationResult','ReviewRound','AcceptanceSettlement','DomainEventEnvelope','CommandActionPreview','KamiyaStructuredResponse'];
for (const name of required) if (!snapshot.schemas.includes(name)) throw new Error(`Contract snapshot is missing ${name}`);

const explicit = process.env.CERBANIMO_REPO;
const candidates = [explicit, path.resolve('..', 'Cerbanimo'), path.resolve('..', 'cerbanimo'), path.resolve('..', '..', '..', 'codeprojects', 'Cerbanimo')].filter(Boolean);
let source;
for (const candidate of candidates) {
  const file = path.join(candidate, 'packages', 'api-contract', 'src', 'index.js');
  try { await access(file); source = file; break; } catch {}
}
if (source) {
  const canonical = await readFile(source, 'utf8');
  for (const name of required) if (!canonical.includes(name)) throw new Error(`Canonical package is missing ${name}`);
  if (!canonical.includes(snapshot.contractVersion)) throw new Error(`Canonical contract version drifted from ${snapshot.contractVersion}`);
  console.log(`Verified generated contract snapshot against ${source}`);
} else {
  console.log('Verified the checked-in contract snapshot. Set CERBANIMO_REPO for cross-repository drift verification.');
}
