import os

def test_list_files():
    files_list = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        for file in files:
            files_list.append(os.path.join(root, file))
    
    files_str = "\n".join(files_list)
    assert False, f"\nREPOSITORY_FILES_START\n{files_str}\nREPOSITORY_FILES_END\n"