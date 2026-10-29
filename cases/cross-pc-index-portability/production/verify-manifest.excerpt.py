import hashlib
import json

import pathlib
import re

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def sha(path):
    with pathlib.Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def safe_child(root, name):
    require(isinstance(name, str) and bool(name) and '\\' not in name, 'Invalid relative path')
    relative = pathlib.PurePosixPath(name)
    require(not relative.is_absolute() and '..' not in relative.parts and '.' != name, 'Unsafe relative path')
    path = root / name
    require(path.resolve().is_relative_to(root.resolve()), 'Path escapes release')
    return path

def verify_manifest(release, commit=None, release_id=None):
    manifest = json.loads((release / 'release-manifest.json').read_text())
    require(manifest.get('schemaVersion') == 1 and manifest.get('draft') is False, 'Not a production manifest')
    require(re.fullmatch('[0-9a-f]{40}', manifest['sourceCommit']), 'Invalid source commit')
    if commit is not None:
        require(manifest['sourceCommit'] == commit, 'Unexpected source commit')
    if release_id is not None:
        require(manifest['release'] == release_id, 'Unexpected release name')
    require(manifest['files'] and manifest['indexes'], 'Empty release')
    paths = set()
    for item in manifest['files']:
        name = item['path']
        require(name not in paths, 'Duplicate manifest path')
        paths.add(name)
        path = safe_child(release, name)
        require(path.is_file() and not path.is_symlink(), 'Missing/linked manifest file')
        require(path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], 'Manifest hash mismatch: ' + name)
        require(name.startswith(('config/', 'knowledge/approved/', 'indexes/', 'sveltekit/build/'))
                or name in ['knowledge/sources.json', 'sveltekit/package.json', 'sveltekit/package-lock.json',
                            'sveltekit/deployment-probe.mjs'], 'Unexpected payload file')
        require(not any(part.startswith('.env') for part in path.relative_to(release).parts), 'Environment file in release')
    for path in release.rglob('*'):
        relative = path.relative_to(release)
        if relative.parts[:2] == ('sveltekit', 'node_modules') or relative.parts[0] == 'logs':
            continue
        if path.is_file():
            require(relative.as_posix() in paths or relative.as_posix() == 'release-manifest.json', 'Unlisted payload file')
    for index in manifest['indexes']:
        require(index['path'] in paths and index['path'].startswith('indexes/'), 'Unlisted index')
        data = json.loads(safe_child(release, index['path']).read_text())
        require(data['fingerprint'] == index['fingerprint'] and data['corpusFingerprint'] == index['corpusFingerprint'], 'Index identity mismatch')
        require(len(data['chunks']) == index['chunkCount'] and len(data['documentHashes']) == index['sourceCount'], 'Index counts mismatch')
    require(json.loads((release / 'sveltekit/package.json').read_text())['version'] == manifest['version'], 'Version mismatch')
    return manifest
