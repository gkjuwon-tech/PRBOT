import os

def test_discover():
    raise Exception("Files in current directory: " + ", ".join(os.listdir('.')))
