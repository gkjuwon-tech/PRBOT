import os

def test_discover():
    files = []
    for root, dirs, filenames in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ('.git', '.pytest_cache', '__pycache__', 'node_modules', 'venv', '.venv')]
        for f in filenames:
            files.append(os.path.join(root, f))
    assert False, f"REPOSITORY_FILES_DISCOVERY:\n" + "\n".join(files)
