const fs = require('fs');

function checkTasks(markdown) {
  const lines = markdown.split('\n');
  const openTasks = [];
  const completedTasks = [];

  const openTaskRegex = /^[-*]\s+\[\s\]\s+(.+)$/i;
  const completedTaskRegex = /^[-*]\s+\[[xX]\]\s+(.+)$/i;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const openMatch = trimmed.match(openTaskRegex);
    if (openMatch) {
      openTasks.push({ line: index + 1, text: openMatch[1] });
      return;
    }
    const completedMatch = trimmed.match(completedTaskRegex);
    if (completedMatch) {
      completedTasks.push({ line: index + 1, text: completedMatch[1] });
    }
  });

  return {
    total: openTasks.length + completedTasks.length,
    open: openTasks,
    completed: completedTasks,
    isComplete: openTasks.length === 0
  };
}

function run() {
  let markdown = '';
  
  // Try reading from GitHub Action environment if available
  if (process.env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      markdown = event.pull_request?.body || '';
    } catch (e) {
      console.error('Failed to parse GITHUB_EVENT_PATH:', e.message);
    }
  }

  // Fallback to reading file arguments
  if (!markdown && process.argv[2]) {
    try {
      markdown = fs.readFileSync(process.argv[2], 'utf8');
    } catch (e) {
      console.error(`Failed to read file: ${process.argv[2]}`, e.message);
      process.exit(1);
    }
  }

  if (!markdown) {
    console.log('No markdown content or PR body was found to inspect.');
    process.exit(0);
  }

  const result = checkTasks(markdown);
  console.log(`Found ${result.total} tasks (${result.completed.length} completed, ${result.open.length} open).`);

  if (!result.isComplete) {
    console.error('\nError: There are incomplete tasks in the markdown content:');
    result.open.forEach(task => {
      console.error(`- Line ${task.line}: ${task.text}`);
    });
    process.exit(1);
  }

  console.log('\nAll tasks are completed! Success.');
  process.exit(0);
}

if (require.main === module) {
  run();
}

module.exports = { checkTasks };