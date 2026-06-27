import os

def test_discover_files():
    found = []
    for root, dirs, files in os.walk('.'):
        if any(ignored in root for ignored in ['.git', '__pycache__', 'node_modules', '.pytest_cache', '.venv', 'env']):
            continue
        for f in files:
            full_path = os.path.join(root, f)
            found.append(full_path)
    
    assert False, "DISCOVERED_FILES:\n" + "\n".join(found)
