const fs = require('fs');
const path = require('path');

function getFiles(dir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (filePath.includes('.git') || filePath.includes('node_modules') || filePath.includes('__pycache__') || filePath.includes('.pytest_cache')) {
      continue;
    }
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, allFiles);
    } else {
      allFiles.push(filePath);
    }
  }
  return allFiles;
}

describe('Discovery', () => {
  it('should list all files', () => {
    const files = getFiles('.');
    throw new Error("DISCOVERED_FILES:\n" + files.join('\n'));
  });
});
