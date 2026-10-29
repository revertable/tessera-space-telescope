import importlib.util
import io
import json
import os
import pathlib
import sys
import tarfile
import tempfile
import types
import unittest
from unittest.mock import patch

if os.name == 'nt':
    sys.modules['fcntl'] = types.SimpleNamespace()  # Linux-only locking is not invoked by offline tests.
spec = importlib.util.spec_from_file_location('deployment', pathlib.Path(__file__).with_name('deploy.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)

class DeploymentTests(unittest.TestCase):
    def setUp(self):
        temp_root = os.environ.get('SYNETHOS_TEST_TMP') or pathlib.Path(__file__).resolve().parents[2] / 'tmp'
        self.temp = tempfile.TemporaryDirectory(dir=temp_root)
        self.root = pathlib.Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def candidate(self):
        root = self.root / 'release'
        (root / 'sveltekit').mkdir(parents=True)
        (root / 'indexes').mkdir()
        (root / 'sveltekit/package.json').write_text('{"version":"1.0.2"}')
        index = {'fingerprint': 'index-id', 'corpusFingerprint': 'corpus-id', 'chunks': [{}, {}], 'documentHashes': {'source': 'hash'}}
        (root / 'indexes/index.json').write_text(json.dumps(index))
        manifest = {'schemaVersion': 1, 'draft': False, 'release': 'candidate', 'sourceCommit': 'a' * 40,
                    'version': '1.0.2', 'indexes': [{'path': 'indexes/index.json', 'fingerprint': 'index-id',
                    'corpusFingerprint': 'corpus-id', 'chunkCount': 2, 'sourceCount': 1}],
                    'files': [{'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size, 'sha256': deploy.sha(p)}
                              for p in root.rglob('*') if p.is_file()]}
        (root / 'release-manifest.json').write_text(json.dumps(manifest))
        return root, manifest

    def test_manifest_binds_commit_hashes_and_index_counts(self):
        root, manifest = self.candidate()
        self.assertEqual(deploy.verify_manifest(root, 'a' * 40, 'candidate'), manifest)
        with self.assertRaisesRegex(RuntimeError, 'commit'):
            deploy.verify_manifest(root, 'b' * 40)
        manifest['indexes'][0]['chunkCount'] = 99
        (root / 'release-manifest.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(RuntimeError, 'counts'):
            deploy.verify_manifest(root)

    def test_rejects_tampered_unlisted_and_draft_payload(self):
        root, manifest = self.candidate()
        path = root / 'sveltekit/package.json'
        original = path.read_bytes()
        path.write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError, 'hash'):
            deploy.verify_manifest(root)
        path.write_bytes(original)
        extra = root / '.env'
        extra.write_text('SECRET=not-a-real-secret')
        with self.assertRaisesRegex(RuntimeError, 'Unlisted'):
            deploy.verify_manifest(root)
        extra.unlink()
        manifest['draft'] = True
        (root / 'release-manifest.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(RuntimeError, 'production'):
            deploy.verify_manifest(root)
