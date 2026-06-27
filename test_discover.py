import os

def test_discover_files():
    files_list = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', '__pycache__', '.pytest_cache', '.venv', 'venv')]
        for file in files:
            files_list.append(os.path.join(root, file))
    assert False, f"Discovered files: {files_list}"
