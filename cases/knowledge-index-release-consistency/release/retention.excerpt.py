import pathlib

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def release_dirs(root):
    dirs = list(root.iterdir())
    require(all(p.is_dir() and not p.is_symlink() and p.resolve().parent == root.resolve()
                and (p / 'release-manifest.json').is_file() for p in dirs), 'Unexpected release entry')
    return dirs


def retention_plan(root, active, previous):
    others = sorted([p for p in release_dirs(root) if p not in [active, previous]],
                    key=lambda p: p.stat().st_mtime_ns, reverse=True)
    retained = [active, previous] + others[:1]
    return retained, others[1:]


def assert_unused(path):
    require(not path.is_symlink() and path.resolve().parent == (ROOT / 'releases').resolve(), 'Unsafe deletion path')
    for proc in pathlib.Path('/proc').iterdir():
        if proc.name.isdigit():
            try:
                cwd = (proc / 'cwd').resolve(strict=True)
                executable = (proc / 'exe').resolve(strict=True)
            except (FileNotFoundError, PermissionError, ProcessLookupError):
                continue
            require(not cwd.is_relative_to(path) and not executable.is_relative_to(path), 'Release still used by a process')
