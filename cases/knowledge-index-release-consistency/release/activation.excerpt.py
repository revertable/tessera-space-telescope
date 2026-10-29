import os

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def normalize_permissions(release):
    # npm inherits umask 077; normalize AFTER installation, retaining executables.
    for directory, dirs, files in os.walk(release, followlinks=False):
        os.chmod(directory, 0o755)
        for name in files:
            path = pathlib.Path(directory) / name
            if not path.is_symlink():
                path.chmod(0o755 if path.stat().st_mode & 0o111 else 0o644)


def switch(current, target):
    temporary = current.with_name('.current-deploy-' + str(os.getpid()))
    require(not temporary.exists() and not temporary.is_symlink(), 'Switch temporary path exists')
    temporary.symlink_to(target)
    try:
        os.replace(temporary, current)
    finally:
        temporary.unlink(missing_ok=True)


def activate(current, release, restart, verify, rollback_verify):
    previous = current.resolve(strict=True)
    switch(current, release)
    try:
        restart()
        return verify()
    except Exception as failure:
        switch(current, previous)
        try:
            restart()
            rollback_verify()
        except Exception as rollback_failure:
            raise RuntimeError('Deployment failed; rollback verification failed') from rollback_failure
        raise RuntimeError('Deployment failed; previous release and index restored') from failure
