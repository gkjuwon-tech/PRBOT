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
  rememberKeys: boolean;
};

const LOCAL_STORAGE_KEY = 'hn-pr-agent-settings';

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

function getInitialFormState(): FormState {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const remember = !!parsed.rememberKeys;
      return {
        token: remember ? (parsed.token || '') : '',
        modelAccess: remember ? (parsed.modelAccess || '') : '',
        repo: parsed.repo || 'gkjuwon-tech/PRBOT',
        branch: parsed.branch || 'main',
        model: parsed.model || 'gemini-3.5-flash',
        jobId: parsed.jobId || '',
        maxSteps: parsed.maxSteps || '3',
        mission: parsed.mission || 'Build a useful feature and open a PR.',
        rememberKeys: remember
      };
    }
  } catch (e) {
    // ignore
  }
  return {
    token: '',
    modelAccess: '',
    repo: 'gkjuwon-tech/PRBOT',
    branch: 'main',
    model: 'gemini-3.5-flash',
    jobId: '',
    maxSteps: '3',
    mission: 'Build a useful feature and open a PR.',
    rememberKeys: false
  };
}

function App() {
  const [form, setForm] = useState<FormState>(getInitialFormState);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('ready. feed me a mission.');

  useEffect(() => {
    try {
      const dataToSave = {
        ...form,
        token: form.rememberKeys ? form.token : '',
        modelAccess: form.rememberKeys ? form.modelAccess : ''
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      // ignore
    }
  }, [form]);

  function clearSaved() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setForm({
        token: '',
        modelAccess: '',
        repo: 'gkjuwon-tech/PRBOT',
        branch: 'main',
        model: 'gemini-3.5-flash',
        jobId: '',
        maxSteps: '3',
        mission: 'Build a useful feature and open a PR.',
        rememberKeys: false
      });
      setMessage('settings cleared.');
    } catch (e) {
      // ignore
    }
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

  let parsedWorkflowUrl = '';
  let parsedWorkflowText = '';
  try {
    const { owner, repo } = parseRepo(form.repo);
    parsedWorkflowUrl = `https://github.com/${owner}/${repo}/actions/workflows/cloud-agent-phone.yml`;
    parsedWorkflowText = `${owner}/${repo} Actions`;
  } catch (e) {
    // ignore
  }

  return (
    <main>
      <header><b>HN Cloud PR Agent</b><span>new | run | continue | memory | prs</span></header>
      <section className="layout">
        <aside>
          <h1>Run from phone</h1>
          <p>This is the app. No laptop. Use the same Job ID to continue a long repo task across multiple runs.</p>
          <form onSubmit={submit}>
            <label>
              GitHub token
              <input type="password" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} placeholder="fine-grained token with Actions: write" />
            </label>
            <label>
              Gemini API key
              <input type="password" value={form.modelAccess} onChange={e => setForm({ ...form, modelAccess: e.target.value })} placeholder="paste Gemini API key" />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: '10px 0' }}>
              <input type="checkbox" checked={form.rememberKeys} onChange={e => setForm({ ...form, rememberKeys: e.target.checked })} style={{ width: 'auto', margin: '0 6px 0 0' }} />
              Remember credentials locally
            </label>
            <label>Repo<input value={form.repo} onChange={e => setForm({ ...form, repo: e.target.value })} /></label>
            <label>Base branch<input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></label>
            <label>Job ID<input value={form.jobId} onChange={e => setForm({ ...form, jobId: e.target.value })} placeholder="same id = continue same task" /></label>
            <label>Steps this run<input value={form.maxSteps} onChange={e => setForm({ ...form, maxSteps: e.target.value })} placeholder="3" /></label>
            <label>Gemini model<select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}><option>gemini-3.5-flash</option><option>gemini-3.1-pro</option></select></label>
            <label>Mission<textarea value={form.mission} onChange={e => setForm({ ...form, mission: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button disabled={busy || !form.token || !form.modelAccess || !form.mission} style={{ flex: 1 }}>{busy ? 'summoning...' : 'run / continue agent'}</button>
              <button type="button" onClick={clearSaved} style={{ background: '#fdd', borderColor: '#caa' }}>Clear settings</button>
            </div>
          </form>
        </aside>
        <section>
          <h1>Status</h1>
          <article className="panel">
            <p>{message}</p>
            {parsedWorkflowUrl && (
              <p style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                💡 Quick link:{' '}
                <a href={parsedWorkflowUrl} target="_blank" rel="noreferrer" style={{ color: '#ff6600', fontWeight: 'bold' }}>
                  {parsedWorkflowText}
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
            <p>The keys go from this page to GitHub's API. There is no separate backend storing them. Saving credentials locally stores them only in this browser's <code>localStorage</code>.</p>
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
