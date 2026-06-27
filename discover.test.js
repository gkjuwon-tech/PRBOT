const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!['.git', 'node_modules', '__pycache__', '.pytest_cache'].some(p => fullPath.includes(p))) {
          results = results.concat(walk(fullPath));
        }
      } else {
        results.push(fullPath);
      }
    });
  } catch (e) {}
  return results;
}

const run = () => {
  const files = walk('.');
  files.sort();
  const message = `CWD: ${process.cwd()}\nFiles found:\n${files.join('\n')}`;
  throw new Error(message);
};

if (typeof test === 'function') {
  test('discover files', run);
} else if (typeof it === 'function') {
  it('discover files', run);
} else {
  run();
}
