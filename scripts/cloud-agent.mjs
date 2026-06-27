import { GoogleGenerativeAI } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import { nanoid } from 'nanoid';

const apiKey = process.env.MODEL_ACCESS || process.env.GEMINI_API_KEY;
const auth = process.env.GH_AUTH;
const repoFull = process.env.GH_REPO;
const mission = process.env.MISSION;
const baseBranch = process.env.BASE_BRANCH || 'main';
const modelName = process.env.MODEL || 'gemini-3.5-flash';

if (!apiKey) throw new Error('Missing model access value');
if (!auth) throw new Error('Missing GitHub workflow token');
if (!repoFull) throw new Error('Missing repository name');
if (!mission) throw new Error('Missing mission');

const [owner, repo] = repoFull.split('/');
const gh = new Octokit({ auth });
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: modelName,
  systemInstruction: 'You are a careful repository automation agent. Return strict JSON. If a proposed file path is rejected by validation, revise the plan and choose an allowed path.',
  generationConfig: { responseMimeType: 'application/json' }
});

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return null;
}

function pathFailure(path) {
  if (!path || typeof path !== 'string') return 'missing path';
  if (path.startsWith('/')) return 'absolute paths are not allowed';
  if (path.includes('..')) return 'parent directory traversal is not allowed';
  if (path.startsWith('.github/workflows/')) return 'reserved automation config path is not allowed here; write a normal source, test, or docs file instead';
  return null;
}

function toPlan(text, label) {
  return extractJson(text) ?? {
    summary: `${label}: captured non-JSON model output as a note.`,
    files: [{ path: `agent-output/${Date.now()}-plan.md`, content: `# Agent output\n\nMission:\n\n${mission}\n\n## Model response\n\n${text}\n` }]
  };
}

async function askModel(prompt) {
  const response = await model.generateContent(prompt);
  return response.response.text();
}

const branch = `cloud-agent/${Date.now()}-${nanoid(5)}`;
const baseRef = await gh.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
await gh.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseRef.data.object.sha });

const basePrompt = `Create a focused implementation for this repository mission.\n\nMission:\n${mission}\n\nReturn JSON with this exact shape:\n{\n  "summary": "short summary",\n  "files": [\n    {"path":"relative/path.ext", "content":"complete file content"}\n  ]\n}\n\nRules:\n- Keep paths relative.\n- Do not write credentials.\n- Do not write reserved automation config paths.\n- If an automation config would be useful, write docs/proposed-automation.md instead.\n- Include practical code, README notes, and tests when useful.\n- Prefer small but complete files.`;

let raw = await askModel(basePrompt);
let plan = toPlan(raw, 'initial output');

for (let attempt = 1; attempt <= 2; attempt++) {
  const invalid = (Array.isArray(plan.files) ? plan.files : [])
    .map(file => ({ path: file?.path, reason: pathFailure(file?.path) }))
    .filter(item => item.reason);

  if (invalid.length === 0) break;

  const feedback = invalid.map(item => `- ${item.path || '(missing path)'}: ${item.reason}`).join('\n');
  raw = await askModel(`${basePrompt}\n\nYour previous plan failed validation.\n\nFailed paths and reasons:\n${feedback}\n\nRevise the plan. Choose allowed replacement paths. Explain the adaptation in summary. Return only JSON.`);
  plan = toPlan(raw, `repair output ${attempt}`);
}

const files = Array.isArray(plan.files) ? plan.files : [];
if (files.length === 0) files.push({ path: `agent-output/${Date.now()}-empty.md`, content: `# Empty agent output\n\nMission:\n\n${mission}\n` });

const skipped = [];
let written = 0;
for (const file of files.slice(0, 30)) {
  const failure = pathFailure(file.path);
  if (failure) {
    skipped.push(`${file.path || '(missing path)'}: ${failure}`);
    continue;
  }
  const content = String(file.content ?? '');
  let sha;
  try {
    const existing = await gh.repos.getContent({ owner, repo, path: file.path, ref: branch });
    if (!Array.isArray(existing.data) && existing.data.sha) sha = existing.data.sha;
  } catch {}
  try {
    await gh.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      branch,
      message: `cloud-agent: update ${file.path}`,
      content: Buffer.from(content).toString('base64'),
      sha
    });
    written += 1;
  } catch (error) {
    skipped.push(`${file.path}: write failed: ${error.message}`);
  }
}

if (skipped.length > 0) {
  await gh.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: `agent-output/${Date.now()}-skipped.md`,
    branch,
    message: 'cloud-agent: record skipped files',
    content: Buffer.from(`# Skipped files\n\nThese failures were fed back to the model before the final write attempt.\n\n${skipped.map(item => `- ${item}`).join('\n')}\n`).toString('base64')
  });
}

if (written === 0 && skipped.length === 0) {
  await gh.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: `agent-output/${Date.now()}-note.md`,
    branch,
    message: 'cloud-agent: add fallback note',
    content: Buffer.from(`# Agent note\n\nMission:\n\n${mission}\n`).toString('base64')
  });
}

const pr = await gh.pulls.create({
  owner,
  repo,
  head: branch,
  base: baseBranch,
  title: `Cloud agent: ${mission.slice(0, 70)}`,
  body: `Mission:\n${mission}\n\nSummary:\n${plan.summary || 'Generated by cloud-agent workflow.'}\n\nGenerated branch: ${branch}`
});

console.log(`PR opened: ${pr.data.html_url}`);
