import os

def discover():
    report = []
    report.append("=== Directory Listing ===")
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'venv', '__pycache__', '.git', '.github')]
        for file in files:
            path = os.path.join(root, file)
            report.append(path)
            
    common_files = ['README.md', 'package.json', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml']
    for cf in common_files:
        if os.path.exists(cf):
            report.append(f"\n=== Content of {cf} ===")
            try:
                with open(cf, 'r', encoding='utf-8') as f:
                    report.append(f.read()[:3000])
            except Exception as e:
                report.append(f"Error reading {cf}: {e}")
                
    with open('discovery_report.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))

if __name__ == '__main__':
    discover()
