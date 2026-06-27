import os

def test_list_files():
    files = []
    for root, dirs, filenames in os.walk('.'):
        if any(p in root for p in ['.git', 'node_modules', '__pycache__', '.pytest_cache', 'venv', '.venv', '.egg-info', 'dist', 'build']):
            continue
        for f in filenames:
            path_str = os.path.join(root, f)
            if not any(p in path_str for p in ['.git/', 'node_modules/', '__pycache__/', '.pytest_cache/', 'venv/', '.venv/']):
                files.append(path_str)
    files.sort()
    raise AssertionError("REPOSITORY_FILES_DISCOVERY:\n" + "\n".join(files))
