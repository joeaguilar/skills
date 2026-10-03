"""Regression coverage for installed payload drift, without touching user skills."""
import os
from pathlib import Path
import shutil
import shlex
import subprocess
import tempfile
import unittest


class InstalledAuditTest(unittest.TestCase):
    def test_payload_drift_and_scope(self):
        bash = shutil.which('bash')
        if not bash and os.name == 'nt':
            bash = r'C:\Program Files\Git\bin\bash.exe'
        script = Path(__file__).with_name('audit-installed-skills.sh').resolve()
        with tempfile.TemporaryDirectory(prefix='skill-audit-') as temp:
            root = Path(temp)
            source = root / 'source'
            installed = root / 'codex' / 'skills'
            legacy = root / 'agents' / 'skills'
            for path in (source / 'demo', installed / 'demo', installed / '.system', legacy):
                path.mkdir(parents=True)
            (source / 'demo' / 'SKILL.md').write_bytes(b'name: demo\n')
            (installed / 'demo' / 'SKILL.md').write_bytes(b'name: demo\r\n')
            # Missing installs and unique local skills are not stale copies.
            for path in (source / 'uninstalled', installed / 'local-only'):
                path.mkdir()
                (path / 'SKILL.md').write_text('local\n')
            env = dict(os.environ, CODEX_HOME=(root / 'codex').as_posix(),
                       AGENTS_HOME=(root / 'agents').as_posix(),
                       CODEX_SKILL_SOURCE=source.as_posix())

            def audit(expected, marker):
                result = subprocess.run([bash, '-lc', 'bash ' + shlex.quote(script.as_posix())], env=env,
                                        text=True, capture_output=True)
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
                self.assertIn(marker, result.stdout)

            audit(0, 'stale=0')
            (installed / 'demo' / 'SKILL.md').write_text('old\n')
            audit(1, 'STALE:     demo')
            (installed / 'demo' / 'SKILL.md').write_bytes(b'name: demo\r\n')
            (source / 'demo' / 'helper.py').write_text('print(1)\n')
            audit(1, 'stale=1')
            (installed / 'demo' / 'helper.py').write_text('print(1)\n')
            audit(0, 'stale=0')
            (legacy / 'demo').mkdir()
            (legacy / 'demo' / 'SKILL.md').write_text('legacy\n')
            audit(1, 'drift=1')


if __name__ == '__main__':
    unittest.main()
