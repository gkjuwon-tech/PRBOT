import os

def test_generate_report():
    report_path = "discovery_report.txt"
    
    # 1. Collect all files
    all_files = []
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("venv", "env", "node_modules", "__pycache__", ".git", ".github", ".pytest_cache")]
        for file in files:
            filepath = os.path.join(root, file)
            all_files.append(filepath)
            
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("=== REPOSITORY FILE LIST ===\n")
        for filepath in all_files:
            f.write(f"- {filepath}\n")
        f.write("\n" + "="*80 + "\n\n")
        
        f.write("=== FILE CONTENTS ===\n\n")
        for filepath in all_files:
            # Skip binary, very large files, or the report itself
            if filepath.endswith((".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", "discovery_report.txt")):
                continue
            f.write(f"File: {filepath}\n")
            f.write("-" * 40 + "\n")
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as tf:
                    content = tf.read(10000)
                    f.write(content)
                    if len(content) == 10000:
                        f.write("\n... [TRUNCATED] ...\n")
            except Exception as e:
                f.write(f"[Could not read file: {e}]\n")
            f.write("\n" + "=" * 80 + "\n\n")
            
    print("Discovery report successfully generated at discovery_report.txt")
