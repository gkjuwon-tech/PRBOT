import { GoogleGenerativeAI } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import { nanoid } from 'nanoid';
import fs from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.MODEL_ACCESS || process.env.GEMINI_API_KEY;
const auth = process.env.GH_AUTH;
const repoFull = process.env.GH_REPO;
const mission = process.env.MISSION;
const baseBranch = process.env.BASE_BRANCH || 'main';
const requestedModelName = (process.env.MODEL || 'gemini-3.1-pro-preview').trim();
const jobId = (process.env.JOB_ID || '').trim() || `job-${Date.now()}`;
const maxSteps = Math.max(1, Math.min(Number(process.env.MAX_STEPS || 1), 8));

if (!apiKey) throw new Error('Missing model access value');
if (!auth) throw new Error('Missing GitHub workflow token');
if (!repoFull) throw new Error('Missing repository name');
if (!mission) throw new Error('Missing mission');

const [owner, repo] = repoFull.split('/');
const gh = new Octokit({ auth });
const genAI = new GoogleGenerativeAI(apiKey);
const modelConfig = {
  systemInstruction: 'You are a careful repository automation agent. Return strict JSON. Use the provided repo snapshot directly. Do not create discovery scripts, failing tests, or workspace dump tests. Implement useful changes in normal source, docs, or passing test files.',
  generationConfig: { responseMimeType: 'application/json' }
};

function b64(text) { return Buffer.from(text).toString('base64'); }
function fromB64(text) { return Buffer.from(text || '', 'base64').toString('utf8'); }
function stamp() { return new Date().toISOString(); }
function normalizeModelName(name) {
  if (name === 'gemini-3.1-pro') return 'gemini-3.1-pro-preview';
  return name;
}
function modelCandidates(name) {
  const first = normalizeModelName(name);
  const list = [first];
  if (first !== 'gemini-3.1-pro-preview') list.push('gemini-3.1-pro-preview');
  return [...new Set(list)];
}
function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return null;
}
function pathFailure(filePath) {
  if (!filePath || typeof filePath !== 'string') return 'missing path';
  if (filePath.startsWith('/')) return 'absolute paths are not allowed';
  if (filePath.includes('..')) return 'parent directory traversal is not allowed';
  if (filePath.startsWith('.github/workflows/')) return 'reserved automation config path is not allowed here; write a normal source, test, or docs file instead';
  if (filePath === 'discover.py' || filePath === 'test_discover.py') return 'discovery-only files are not useful product changes; use the provided repo snapshot and implement a real feature instead';
  if (filePath.includes('discovery_report')) return 'discovery report files are not useful product changes; implement the feature directly';
  return null;
}
function contentFailure(filePath, content) {
  const text = String(content || '');
  const lowered = text.toLowerCase();
  if (text.includes('WORKSPACE_DUMP_START')) return 'workspace dump tests are forbidden; the runner already provides a repo snapshot';
  if (lowered.includes('assert false') || lowered.includes('assertfalse')) return 'intentionally failing tests are forbidden; tests must pass';
  if (lowered.includes('dump all') && lowered.includes('files') && lowered.includes('contents')) return 'dumping all repository file contents is forbidden; use the provided bounded snapshot';
  if (filePath?.startsWith('test') && lowered.includes('raise assertionerror')) return 'intentionally failing tests are forbidden; tests must pass';
  return null;
}
function score(text, query) {
  const hay = String(text || '').toLowerCase();
  return String(query || '').toLowerCase().split(/\W+/).filter(Boolean).reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
}
function toPlan(text, label) {
  return extractJson(text) ?? {
    summary: `${label}: captured non-JSON model output as a note.`,
    files: [{ path: `agent-output/${Date.now()}-plan.md`, content: `# Agent output\n\nMission:\n\n${mission}\n\n## Model response\n\n${text}\n` }]
  };
}
async function askModel(prompt) {
  let lastError;
  for (const name of modelCandidates(requestedModelName)) {
    try {
      console.log(`Using model: ${name}`);
      const model = genAI.getGenerativeModel({ model: name, ...modelConfig });
      const response = await model.generateContent(prompt);
      return response.response.text();
    } catch (error) {
      lastError = error;
      console.log(`Model attempt failed for ${name}: ${error.message}`);
      if (!String(error.message || '').includes('not found') && error.status !== 404) throw error;
    }
  }
  throw lastError;
}

const snapshotSkipDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.pytest_cache', '__pycache__', '.venv', 'venv', 'coverage']);
const snapshotPreferred = [
  'README.md', 'package.json', 'pnpm-workspace.yaml', 'tsconfig.json',
  'apps/web/package.json', 'apps/web/src/main.tsx', 'apps/web/src/style.css', 'apps/web/vite.config.ts',
  'scripts/cloud-agent.mjs', '.github/workflows/cloud-agent-phone.yml', '.github/workflows/web-gh-pages.yml'
];
async function exists(filePath) {
  try { await fs.stat(filePath); return true; } catch { return false; }
}
async function walkRepo(dir = '.', out = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = full.replace(/^\.\//, '');
    if (entry.isDirectory()) {
      if (snapshotSkipDirs.has(entry.name) || rel.startsWith('.agent/')) continue;
      await walkRepo(full, out);
    } else if (entry.isFile()) {
      if (rel.startsWith('.agent/')) continue;
      if (/\.(png|jpg|jpeg|gif|webp|zip|gz|lock)$/i.test(rel)) continue;
      out.push(rel);
    }
    if (out.length >= 80) return out;
  }
  return out;
}
async function buildRepoSnapshot() {
  const allFiles = await walkRepo();
  const selected = [];
  for (const file of snapshotPreferred) if (await exists(file)) selected.push(file);
  for (const file of allFiles) {
    if (selected.length >= 18) break;
    if (!selected.includes(file) && /\.(md|json|yml|yaml|ts|tsx|js|mjs|css|html|py)$/i.test(file)) selected.push(file);
  }
  const parts = [`File tree sample:\n${allFiles.slice(0, 80).map(f => `- ${f}`).join('\n')}`];
  for (const file of selected) {
    try {
      const text = await fs.readFile(file, 'utf8');
      parts.push(`\n--- ${file} ---\n${text.slice(0, 5000)}`);
    } catch {}
  }
  return parts.join('\n').slice(0, 40000);
}

const repoSnapshot = await buildRepoSnapshot();
const branch = `agent/${jobId}`;
const statePath = `.agent/state/${jobId}.json`;
const logPath = `.agent/logs/${jobId}.md`;
let createdBranch = false;

try {
  await gh.git.getRef({ owner, repo, ref: `heads/${branch}` });
  console.log(`Continuing existing job branch: ${branch}`);
} catch {
  const baseRef = await gh.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  await gh.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseRef.data.object.sha });
  createdBranch = true;
  console.log(`Initialized new job branch: ${branch}`);
}

async function readFile(filePath) {
  try {
    const res = await gh.repos.getContent({ owner, repo, path: filePath, ref: branch });
    if (!Array.isArray(res.data)) return { text: fromB64(res.data.content), sha: res.data.sha };
  } catch {}
  return { text: '', sha: undefined };
}
async function writeFile(filePath, text, message) {
  let sha;
  try {
    const existing = await gh.repos.getContent({ owner, repo, path: filePath, ref: branch });
    if (!Array.isArray(existing.data)) sha = existing.data.sha;
  } catch {}
  await gh.repos.createOrUpdateFileContents({ owner, repo, path: filePath, branch, message, content: b64(text), sha });
}
function freshState() {
  return {
    jobId,
    mission,
    branch,
    createdAt: stamp(),
    updatedAt: stamp(),
    runCount: 0,
    stepCount: 0,
    tasks: [
      { id: nanoid(8), title: 'Understand provided repo snapshot', status: 'pending', notes: '' },
      { id: nanoid(8), title: 'Ship a small useful implementation slice', status: 'pending', notes: '' },
      { id: nanoid(8), title: 'Record progress and create concrete next tasks', status: 'pending', notes: '' }
    ],
    memory: [],
    changedFiles: [],
    openQuestions: [],
    prUrl: null
  };
}

const oldState = await readFile(statePath);
let state;
try { state = oldState.text ? { ...freshState(), ...JSON.parse(oldState.text) } : freshState(); } catch { state = freshState(); }
if (createdBranch && !oldState.text) state.memory.push({ at: stamp(), kind: 'init', text: `New job registered: ${jobId} on ${branch}` });
for (const task of state.tasks) {
  const bad = `${task.title} ${task.notes}`.toLowerCase();
  if ((task.status === 'pending' || task.status === 'running') && (bad.includes('workspace dump') || bad.includes('discovery report') || bad.includes('test output'))) {
    task.status = 'blocked';
    task.notes = 'Blocked by runner policy: use provided repo snapshot directly; do not rely on failing tests or discovery dumps.';
  }
}
if (!state.tasks.some(t => t.status === 'pending')) {
  state.tasks.push({ id: nanoid(8), title: 'Implement a real feature from the provided repo snapshot', status: 'pending', notes: 'Created after blocking discovery-loop tasks.' });
}
state.runCount += 1;
state.updatedAt = stamp();

function taskSummary() {
  return state.tasks.map(t => `- [${t.status}] ${t.id}: ${t.title}${t.notes ? ` — ${t.notes}` : ''}`).join('\n');
}
function nextTask() {
  let task = state.tasks.find(t => t.status === 'pending');
  if (!task) {
    task = { id: nanoid(8), title: 'Plan next useful implementation step from repo snapshot', status: 'pending', notes: 'auto-created' };
    state.tasks.push(task);
  }
  return task;
}
function retrieveMemory(query) {
  return [...(state.memory || [])].map(item => ({ item, score: score(`${item.kind} ${item.text}`, query) })).sort((a, b) => b.score - a.score).slice(0, 8).map(x => x.item);
}
async function saveState() {
  state.updatedAt = stamp();
  await writeFile(statePath, JSON.stringify(state, null, 2), 'agent: save long task state');
}
async function appendLog(text) {
  const old = await readFile(logPath);
  await writeFile(logPath, `${old.text}\n\n## ${stamp()}\n\n${text}\n`, 'agent: append long task log');
}

await saveState();
await appendLog(`${createdBranch ? 'New job initialized' : 'Existing job resumed'}. Run ${state.runCount} started. jobId=${jobId}, maxSteps=${maxSteps}, model=${normalizeModelName(requestedModelName)}\n\nRepo snapshot was provided directly to the model. Discovery loops and failing workspace-dump tests are blocked.`);

for (let step = 0; step < maxSteps; step++) {
  const task = nextTask();
  task.status = 'running';
  state.stepCount += 1;
  const mem = retrieveMemory(`${mission} ${task.title}`).map(m => `- ${m.kind || 'note'}: ${m.text}`).join('\n') || '- none';
  const basePrompt = `Continue this long-running repository task.\n\nMission:\n${mission}\n\nCurrent task:\n${task.id}: ${task.title}\n\nSaved tasks:\n${taskSummary()}\n\nRetrieved memory:\n${mem}\n\nChanged files so far:\n${state.changedFiles.join('\n') || '(none)'}\n\nCurrent repo snapshot, already collected for you:\n${repoSnapshot}\n\nReturn JSON:\n{\n  "summary":"short summary",\n  "files":[{"path":"relative/path.ext","content":"complete file content"}],\n  "taskUpdates":[{"id":"task id","status":"pending|running|done|blocked","notes":"note"}],\n  "newTasks":[{"title":"small next task","notes":"why"}],\n  "memories":[{"kind":"decision|finding|todo|constraint","text":"durable memory"}],\n  "openQuestions":["question"]\n}\n\nRules:\n- Use the repo snapshot above directly.\n- Do not create discovery scripts.\n- Do not create failing tests.\n- Do not create workspace dump tests.\n- Do not defer analysis to a future test run.\n- Keep paths relative.\n- Do not write reserved automation config paths.\n- Keep each step small and concrete.\n- Prefer useful complete product/source/docs changes.\n- Tests, if created, must be intended to pass.`;
  let raw = await askModel(basePrompt);
  let plan = toPlan(raw, 'step output');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const invalid = (Array.isArray(plan.files) ? plan.files : [])
      .map(file => ({ path: file?.path, reason: pathFailure(file?.path) || contentFailure(file?.path, file?.content) }))
      .filter(item => item.reason);
    if (invalid.length === 0) break;
    const feedback = invalid.map(item => `- ${item.path || '(missing path)'}: ${item.reason}`).join('\n');
    raw = await askModel(`${basePrompt}\n\nYour previous plan failed validation.\n\nFailed paths or contents and reasons:\n${feedback}\n\nRevise the plan using allowed paths and useful product changes. Return only JSON.`);
    plan = toPlan(raw, `repair output ${attempt}`);
  }

  const skipped = [];
  const written = [];
  for (const file of (Array.isArray(plan.files) ? plan.files : []).slice(0, 20)) {
    const failure = pathFailure(file.path) || contentFailure(file.path, file.content);
    if (failure) { skipped.push(`${file.path || '(missing path)'}: ${failure}`); continue; }
    try {
      await writeFile(file.path, String(file.content ?? ''), `agent: update ${file.path}`);
      written.push(file.path);
      if (!state.changedFiles.includes(file.path)) state.changedFiles.push(file.path);
    } catch (error) {
      skipped.push(`${file.path}: ${error.message}`);
    }
  }

  for (const update of Array.isArray(plan.taskUpdates) ? plan.taskUpdates : []) {
    const target = state.tasks.find(t => t.id === update.id);
    if (target) { if (update.status) target.status = update.status; if (update.notes) target.notes = update.notes; }
  }
  if (task.status === 'running') task.status = written.length ? 'done' : 'blocked';
  for (const newTask of Array.isArray(plan.newTasks) ? plan.newTasks : []) {
    if (newTask.title && !state.tasks.some(t => t.title === newTask.title)) state.tasks.push({ id: nanoid(8), title: newTask.title, status: 'pending', notes: newTask.notes || '' });
  }
  for (const item of Array.isArray(plan.memories) ? plan.memories : []) state.memory.push({ at: stamp(), kind: item.kind || 'note', text: String(item.text || '') });
  state.memory.push({ at: stamp(), kind: 'step', text: `Step ${state.stepCount}: ${plan.summary || 'no summary'}; wrote ${written.join(', ') || 'none'}; skipped ${skipped.join(', ') || 'none'}` });
  if (state.memory.length > 200) state.memory = state.memory.slice(-200);
  for (const q of Array.isArray(plan.openQuestions) ? plan.openQuestions : []) state.openQuestions.push(String(q));
  await appendLog(`Step ${state.stepCount}: ${plan.summary || '(no summary)'}\n\nWritten:\n${written.map(x => `- ${x}`).join('\n') || '- none'}\n\nSkipped:\n${skipped.map(x => `- ${x}`).join('\n') || '- none'}\n\nTasks:\n${taskSummary()}`);
  await saveState();
}

if (!state.prUrl) {
  try {
    const pr = await gh.pulls.create({ owner, repo, head: branch, base: baseBranch, title: `Agent job ${jobId}: ${mission.slice(0, 60)}`, body: `Long-running agent job.\n\nJob id: ${jobId}\n\nMission:\n${mission}\n\nState: ${statePath}\nLog: ${logPath}` });
    state.prUrl = pr.data.html_url;
  } catch (error) {
    state.openQuestions.push(`PR creation failed: ${error.message}`);
  }
}
await saveState();
await appendLog(`Run complete. PR: ${state.prUrl || '(not created)'}`);
console.log(`Job ${jobId} run complete. PR: ${state.prUrl || '(not created)'}`);
