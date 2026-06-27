import os

def test_discover_files():
    results = []
    for root, dirs, files in os.walk("."):
        if any(p in root for p in [".git", "node_modules", "__pycache__", ".pytest_cache"]):
            continue
        for file in files:
            path = os.path.join(root, file)
            results.append(path)
    
    results.sort()
    cwd = os.getcwd()
    message = f"CWD: {cwd}\nFiles found:\n" + "\n".join(results)
    raise AssertionError(message)
