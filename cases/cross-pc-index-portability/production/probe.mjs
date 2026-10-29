// Run as the service account, with its environment. No provider/API calls.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
await import('dotenv');
await import('@google/genai');
const root = fs.realpathSync(process.env.MOSAIC_PROJECT_ROOT);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'));
const chunks = path.join(root, 'sveltekit/build/server/chunks');
async function exportedFunction(prefix, name) {
  const files = fs.readdirSync(chunks).filter(file => file.startsWith(prefix + '-') && file.endsWith('.js'));
  if (files.length !== 1) throw new Error('Ambiguous compiled module: ' + prefix);
  const module = await import(pathToFileURL(path.join(chunks, files[0])).href);
  const fn = Object.values(module).find(value => typeof value === 'function' && value.name === name);
  if (!fn) throw new Error('Missing compiled function: ' + name);
  return fn;
}
const config = (await exportedFunction('config', 'loadConfig'))();
const configPath = path.resolve(root, process.env.MOSAIC_CONFIG_PATH ?? 'config/mosaic.json');
if (fs.realpathSync(configPath) !== path.join(root, 'config/mosaic.json')) {
  throw new Error('Runtime configuration must belong to the active release');
}
for (const location of [config.knowledge.manifestPath, config.retrieval.indexDirectory]) {
  const relative = path.relative(root, fs.realpathSync(location));
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Knowledge/index must belong to the active release');
  }
}
const statuses = await (await exportedFunction('indexer', 'getIndexStatus'))(config);
const expectedIndexes = manifest.indexes ?? [{ path: manifest.indexPath, fingerprint: manifest.indexFingerprint,
  sourceCount: manifest.sourceCount, chunkCount: manifest.chunkCount }];
const indexes = statuses.map(status => {
  if (status.state !== 'current') throw new Error('Index is not current: ' + status.target.id);
  const relative = path.relative(root, fs.realpathSync(status.path)).split(path.sep).join('/');
  const expected = expectedIndexes.find(index => index.path === relative);
  const data = JSON.parse(fs.readFileSync(status.path, 'utf8'));
  const result = { path: relative, fingerprint: status.fingerprint, corpusFingerprint: status.corpusFingerprint,
    sourceCount: Object.keys(data.documentHashes).length, chunkCount: status.chunkCount };
  if (!expected || Object.keys(result).some(key => key in expected && expected[key] !== result[key])) throw new Error('Loaded index differs from manifest');
  return result;
});
if (indexes.length !== expectedIndexes.length) throw new Error('Index target count differs');
console.log(JSON.stringify({ sourceCommit: manifest.sourceCommit, projectRoot: root, indexes, imports: 'passed' }));
