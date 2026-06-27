const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!['.git', 'node_modules', '.pytest_cache', '__pycache__', 'venv', '.venv', '.env'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      results.push(filePath);
    }
  });
  return results;
}

test('discover files', () => {
  const files = walk('.');
  throw new Error(`DISCOVERED_FILES_START\n${JSON.stringify(files, null, 2)}\nDISCOVERED_FILES_END`);
});