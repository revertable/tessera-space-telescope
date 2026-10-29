"""Offline safety regressions; never contact systemd, SSH or production."""
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

    @unittest.skipIf(os.name == 'nt', 'Atomic symlink switching requires POSIX')
    def test_actual_atomic_symlink_rolls_back_index_with_knowledge(self):
        previous, candidate = self.root / 'old', self.root / 'new'
        for directory, value in [(previous, 'old'), (candidate, 'new')]:
            directory.mkdir()
            (directory / 'knowledge.md').write_text(value)
            (directory / 'index.json').write_text(value)
        current = self.root / 'current'
        current.symlink_to(previous)

        def check(value):
            self.assertEqual((current / 'knowledge.md').read_text(), value)
            self.assertEqual((current / 'index.json').read_text(), value)

        def fail():
            check('new')
            raise RuntimeError('injected health failure')

        with self.assertRaisesRegex(RuntimeError, 'restored'):
            deploy.activate(current, candidate, lambda: None, fail, lambda: check('old'))
        self.assertEqual(current.resolve(), previous)
        self.assertFalse(list(self.root.glob('.current-deploy-*')))

    def test_retention_keeps_active_previous_and_newest_other(self):
        releases = self.root / 'releases'
        releases.mkdir()
        paths = []
        for i in range(5):
            path = releases / str(i)
            path.mkdir()
            (path / 'release-manifest.json').write_text('{}')
            os.utime(path, ns=(i * 1000000000, i * 1000000000))
            paths.append(path)
        retained, removed = deploy.retention_plan(releases, paths[4], paths[1])
        self.assertEqual(retained, [paths[4], paths[1], paths[3]])
        self.assertEqual(set(removed), {paths[0], paths[2]})
