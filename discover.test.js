const fs = require('fs');

test('discover files', () => {
  throw new Error("Files in current directory: " + fs.readdirSync('.').join(', '));
});
