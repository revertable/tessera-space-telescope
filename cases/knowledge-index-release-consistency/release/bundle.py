"""Create a candidate from a verified local build. Refuse dirty production bundles."""
import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import tarfile
from datetime import datetime, timezone


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args]).decode().strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--release', required=True)
    parser.add_argument('--draft', action='store_true', help='Review only; cannot be deployed')
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parents[2]
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}', args.release):
        raise ValueError('Invalid release name')
    commit = git(root, 'rev-parse', 'HEAD')
    dirty = bool(git(root, 'status', '--porcelain'))
    if dirty and not args.draft:
        raise ValueError('Production bundle requires a clean committed tree')
    output = pathlib.Path(args.output).resolve()
    if not output.is_relative_to(root / 'tmp') or output.exists():
        raise ValueError('Use a new directory under repository tmp/')
    output.mkdir(parents=True)
    payload = output / 'payload'
    payload.mkdir()
    files = [root / 'config/mosaic.json', root / 'knowledge/sources.json',
             root / 'sveltekit/package.json', root / 'sveltekit/package-lock.json']
    sources = json.loads((root / 'knowledge/sources.json').read_text(encoding='utf-8'))['sources']
    for source in sources:
        path = (root / 'knowledge' / source['file']).resolve()
        if not path.is_relative_to(root / 'knowledge/approved'):
            raise ValueError('Only approved knowledge may be bundled')
        files.append(path)
    files += sorted((root / 'indexes').rglob('*.json'))
    if not (root / 'sveltekit/build/index.js').is_file():
        raise ValueError('Production build missing')
    files += sorted(p for p in (root / 'sveltekit/build').rglob('*') if p.is_file())
    indexes = []
    for path in files:
        relative = path.relative_to(root)
        target = payload / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        if relative.parts[0] == 'indexes':
            index = json.loads(path.read_text(encoding='utf-8'))
            indexes.append({'path': relative.as_posix(), 'fingerprint': index['fingerprint'],
                            'corpusFingerprint': index['corpusFingerprint'],
                            'sourceCount': len(index['documentHashes']), 'chunkCount': len(index['chunks'])})
    shutil.copyfile(root / 'scripts/deployment/probe.mjs', payload / 'sveltekit/deployment-probe.mjs')
    manifest = {'schemaVersion': 1, 'release': args.release, 'sourceCommit': commit,
                'draft': args.draft, 'version': json.loads((root / 'sveltekit/package.json').read_text())['version'],
                'node': 'v24.22.1', 'createdAt': datetime.now(timezone.utc).isoformat(), 'indexes': indexes,
                'files': [{'path': p.relative_to(payload).as_posix(), 'bytes': p.stat().st_size, 'sha256': digest(p)}
                          for p in sorted(payload.rglob('*')) if p.is_file()]}
    (payload / 'release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    archive = output / 'release.tar.gz'
    with tarfile.open(archive, 'w:gz') as stream:
        for path in sorted(payload.rglob('*')):
            stream.add(path, arcname=path.relative_to(payload).as_posix(), recursive=False)
    (output / 'archive.sha256').write_text(digest(archive) + '  release.tar.gz\n')
    shutil.copyfile(root / 'scripts/deployment/deploy.py', output / 'deploy.py')
    print(json.dumps({'sourceCommit': commit, 'release': args.release, 'draft': args.draft,
                      'archiveSha256': digest(archive), 'manifestSha256': digest(payload / 'release-manifest.json'),
                      'fileCount': len(manifest['files']), 'indexes': indexes}))


if __name__ == '__main__':
    main()
