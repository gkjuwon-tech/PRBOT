const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('venv') && !fullPath.includes('.venv') && !fullPath.includes('__pycache__')) {
        results = results.concat(walk(fullPath));
      }
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

test('discover files', () => {
  const files = walk('.');
  files.sort();
  throw new Error("REPOSITORY_FILES_DISCOVERY:\n" + files.join("\n"));
});
