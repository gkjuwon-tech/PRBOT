import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type FormState = {
  token: string;
  modelAccess: string;
  repo: string;
  branch: string;
  model: string;
  mission: string;
};

function parseRepo(value: string) {
  const cleaned = value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  const [owner, repo] = cleaned.split('/');
  if (!owner || !repo) throw new Error('Repo must look like owner/name');
  return { owner, repo };
}

function App() {
  const [form, setForm] = useState<FormState>({
    token: '',
    modelAccess: '',
    repo: 'gkjuwon-tech/PRBOT',
    branch: 'main',
    model: 'gemini-3.5-flash',
    mission: 'Build a useful feature and open a PR.'
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('ready. feed me a mission.');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('calling GitHub Actions... little orange goblin is putting on boots.');
    try {
      const { owner, repo } = parseRepo(form.repo);
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
            model_access: form.modelAccess
          }
        })
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      setMessage(`workflow started. open https://github.com/${owner}/${repo}/actions/workflows/cloud-agent-phone.yml`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header><b>HN Cloud PR Agent</b><span>new | run | workflows | prs | complain loudly</span></header>
      <section className="layout">
        <aside>
          <h1>Run from phone</h1>
          <p>This is the app. No laptop. No local server. Your phone is the remote control, GitHub Actions is the worker goblin.</p>
          <form onSubmit={submit}>
            <label>GitHub token<input type="password" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} placeholder="fine-grained token with Actions: write" /></label>
            <label>Gemini API key<input type="password" value={form.modelAccess} onChange={e => setForm({ ...form, modelAccess: e.target.value })} placeholder="paste Gemini API key" /></label>
            <label>Repo<input value={form.repo} onChange={e => setForm({ ...form, repo: e.target.value })} /></label>
            <label>Base branch<input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></label>
            <label>Gemini model<select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}><option>gemini-3.5-flash</option><option>gemini-3.1-pro</option></select></label>
            <label>Mission<textarea value={form.mission} onChange={e => setForm({ ...form, mission: e.target.value })} /></label>
            <button disabled={busy || !form.token || !form.modelAccess || !form.mission}>{busy ? 'summoning...' : 'run cloud agent'}</button>
          </form>
        </aside>
        <section>
          <h1>Status</h1>
          <article className="panel"><p>{message}</p></article>
          <article className="panel">
            <h2>What this UI does</h2>
            <ol>
              <li>Calls GitHub's workflow dispatch API directly from your browser.</li>
              <li>Starts <code>cloud-agent-phone.yml</code> in GitHub Actions.</li>
              <li>The workflow calls Gemini in the cloud using the key you typed.</li>
              <li>The workflow creates a branch, commits files, and opens a PR.</li>
            </ol>
            <p>The keys go from this page to GitHub's API. There is no separate app server.</p>
          </article>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
