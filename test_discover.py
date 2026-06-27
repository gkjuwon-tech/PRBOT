import unittest
import os

class TestDiscover(unittest.TestCase):
    def test_discover_files(self):
        file_list = []
        for root, dirs, files in os.walk('.'):
            if any(p in root for p in ['.git', '__pycache__', '.pytest_cache', '.venv', 'node_modules']):
                continue
            for f in files:
                full_path = os.path.join(root, f)
                if f.endswith(('.py', '.json', '.md', '.txt', '.yml', '.yaml', '.toml', '.js', '.ts', '.go', '.rs', '.java', '.sh', 'Dockerfile')):
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='ignore') as file_content:
                            head = file_content.read(1500)
                    except Exception as e:
                        head = f"Error reading: {e}"
                    file_list.append(f"PATH: {full_path}\nCONTENT:\n{head}\n{'='*50}")
                else:
                    file_list.append(f"PATH (other): {full_path}")
        
        joined = '\n'.join(file_list)
        self.fail(f"\n=== REPO FILES ===\n{joined}\n=== END REPO FILES ===")
