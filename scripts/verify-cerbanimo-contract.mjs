import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const snapshot = JSON.parse(await readFile(new URL('../shared/generated/cerbanimo-contract.json', import.meta.url), 'utf8'));
if (snapshot.contractVersion !== '1.0.0') throw new Error(`Unsupported Cerbanimo contract ${snapshot.contractVersion}`);
if (!/^sha256:[a-f0-9]{64}$/.test(snapshot.digest)) throw new Error('The checked-in Cerbanimo contract digest is invalid.');
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
  const canonical = await import(`${pathToFileURL(source).href}?contract-audit=${Date.now()}`);
  if (canonical.CONTRACT_VERSION !== snapshot.contractVersion) {
    throw new Error(`Canonical contract version ${canonical.CONTRACT_VERSION} drifted from ${snapshot.contractVersion}`);
  }
  if (canonical.CONTRACT_SCHEMA_DIGEST !== snapshot.digest) {
    throw new Error(`Canonical contract digest ${canonical.CONTRACT_SCHEMA_DIGEST} drifted from ${snapshot.digest}`);
  }
  const canonicalSchemas = Object.keys(canonical.apiContractSchemas).sort();
  const snapshotSchemas = [...snapshot.schemas].sort();
  if (JSON.stringify(canonicalSchemas) !== JSON.stringify(snapshotSchemas)) {
    throw new Error(`Canonical schema inventory drifted: ${canonicalSchemas.join(', ')}`);
  }
  console.log(`Verified generated contract snapshot against ${source}`);
} else {
  console.log('Verified the checked-in contract snapshot. Set CERBANIMO_REPO for cross-repository drift verification.');
}
