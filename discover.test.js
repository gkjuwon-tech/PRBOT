const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    if (file.startsWith('.') || file === 'node_modules') {
      return;
    }
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

test('discover files', () => {
  const files = walk('.');
  throw new Error(`\nREPOSITORY_FILES_START\n${files.join('\n')}\nREPOSITORY_FILES_END\n`);
});