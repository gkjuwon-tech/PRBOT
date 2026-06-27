import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type FormState = {
  token: string;
  modelAccess: string;
  repo: string;
  branch: string;
  model: string;
  jobId: string;
  maxSteps: string;
  mission: string;
  rememberCreds: boolean;
};

const DEFAULT_STATE: FormState = {
  token: '',
  modelAccess: '',
  repo: 'gkjuwon-tech/PRBOT',
  branch: 'main',
  model: 'gemini-3.5-flash',
  jobId: '',
  maxSteps: '3',
  mission: 'Build a useful feature and open a PR.',
  rememberCreds: false
};

const STORAGE_KEY = 'hn-pr-agent-config-v1';

function parseRepo(value: string) {
  const cleaned = value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  const [owner, repo] = cleaned.split('/');
  if (!owner || !repo) throw new Error('Repo must look like owner/name');
  return { owner, repo };
}

function makeJobId(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return slug || `job-${Date.now()}`;
}

function App() {
  const [form, setForm] = useState<FormState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          // don't restore credentials if rememberCreds is false
          token: parsed.rememberCreds ? parsed.token || '' : '',
          modelAccess: parsed.rememberCreds ? parsed.modelAccess || '' : ''
        };
      }
    } catch (e) {
      console.error('Error loading config from localStorage', e);
    }
    return DEFAULT_STATE;
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('ready. feed me a mission.');

  // Save changes to localStorage
  useEffect(() => {
    try {
      const dataToSave = {
        ...form,
        // clear credentials if rememberCreds is false
        token: form.rememberCreds ? form.token : '',
        modelAccess: form.rememberCreds ? form.modelAccess : ''
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('Error saving config to localStorage', e);
    }
  }, [form]);

  function handleReset() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      localStorage.removeItem(STORAGE_KEY);
      setForm(DEFAULT_STATE);
      setMessage('Settings reset to default.');
    }
  }

  let repoInfo = { owner: 'gkjuwon-tech', repo: 'PRBOT' };
  let repoValid = false;
  try {
    repoInfo = parseRepo(form.repo);
    repoValid = true;
  } catch {
    // typing...
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('calling GitHub Actions... little orange goblin is putting on boots.');
    try {
      const { owner, repo } = parseRepo(form.repo);
      const jobId = form.jobId.trim() || makeJobId(form.mission);
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/cloud-agent-phone.yml/dispatches`, {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${form.token}`,
          'x-github-api-version': '2022-11-28',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          ref: form.branch,
          inputs: {
            mission: form.mission,
            base_branch: form.branch,
            model: form.model,
            model_access: form.modelAccess,
            job_id: jobId,
            max_steps: form.maxSteps
          }
        })
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      setMessage(`workflow started for ${jobId}. Use the same Job ID to continue. Open https://github.com/${owner}/${repo}/actions/workflows/cloud-agent-phone.yml`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const actionsUrl = repoValid
    ? `https://github.com/${repoInfo.owner}/${repoInfo.repo}/actions/workflows/cloud-agent-phone.yml`
    : 'https://github.com';

  return (
    <main>
      <header>
        <b>HN Cloud PR Agent</b>
        <span>
          <a href={actionsUrl} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>runs</a> | 
          <span style={{ cursor: 'pointer' }} onClick={handleReset}> reset</span>
        </span>
      </header>
      <section className="layout">
        <aside>
          <h1>Run from phone</h1>
          <p>This is the app. No laptop. Use the same Job ID to continue a long repo task across multiple runs.</p>
          <form onSubmit={submit}>
            <label>
              GitHub token
              <input 
                type="password" 
                value={form.token} 
                onChange={e => setForm({ ...form, token: e.target.value })} 
                placeholder="fine-grained token with Actions: write" 
              />
            </label>
            <label>
              Gemini API key
              <input 
                type="password" 
                value={form.modelAccess} 
                onChange={e => setForm({ ...form, modelAccess: e.target.value })} 
                placeholder="paste Gemini API key" 
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', margin: '4px 0 10px' }}>
              <input 
                type="checkbox" 
                style={{ width: 'auto', margin: 0 }} 
                checked={form.rememberCreds} 
                onChange={e => setForm({ ...form, rememberCreds: e.target.checked })} 
              />
              Remember credentials (saved in browser local storage)
            </label>
            <label>Repo<input value={form.repo} onChange={e => setForm({ ...form, repo: e.target.value })} /></label>
            <label>Base branch<input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></label>
            <label>Job ID<input value={form.jobId} onChange={e => setForm({ ...form, jobId: e.target.value })} placeholder="same id = continue same task" /></label>
            <label>Steps this run<input value={form.maxSteps} onChange={e => setForm({ ...form, maxSteps: e.target.value })} placeholder="3" /></label>
            <label>Gemini model
              <select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                <option>gemini-3.5-flash</option>
                <option>gemini-3.1-pro</option>
              </select>
            </label>
            <label>Mission<textarea value={form.mission} onChange={e => setForm({ ...form, mission: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button 
                style={{ flex: 1 }} 
                disabled={busy || !form.token || !form.modelAccess || !form.mission || !repoValid}
              >
                {busy ? 'summoning...' : 'run / continue agent'}
              </button>
              <button 
                type="button" 
                onClick={handleReset} 
                style={{ background: '#f6f6ef', color: '#666', border: '1px solid #ccc' }}
              >
                Reset
              </button>
            </div>
          </form>
        </aside>
        <section>
          <h1>Status</h1>
          <article className="panel">
            <p>{message}</p>
            {repoValid && (
              <p style={{ marginTop: '10px' }}>
                <a href={actionsUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 'bold', color: '#ff6600' }}>
                  → Open Actions Workflow Logs for {repoInfo.owner}/{repoInfo.repo}
                </a>
              </p>
            )}
          </article>
          <article className="panel">
            <h2>Long task mode</h2>
            <ol>
              <li>Calls GitHub's workflow dispatch API directly from your browser.</li>
              <li>Starts <code>cloud-agent-phone.yml</code> in GitHub Actions.</li>
              <li>The workflow uses Job ID and Steps this run to continue a saved task.</li>
              <li>The agent records state, logs, tasks, and memory in the repo branch.</li>
            </ol>
            <p>The keys go from this page to GitHub's API. There is no separate app backend storing them.</p>
          </article>
        </section>
      </section>
    </main>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
