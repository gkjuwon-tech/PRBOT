# Phone-only Cloud Agent

You do not need a laptop for this flow.

## One-time setup

1. Open GitHub on your phone.
2. Open this repository.
3. Go to Settings -> Secrets and variables -> Actions.
4. Add a repository secret named `GEMINI_API_KEY`.
5. Merge the PR that adds the cloud agent workflow.

## Run from phone

1. Open the Actions tab.
2. Choose `cloud-agent`.
3. Tap `Run workflow`.
4. Enter a mission.
5. Pick the base branch and Gemini model.
6. Wait for the workflow to open a PR.

## What happens in the cloud

- GitHub Actions starts an Ubuntu runner.
- The runner calls Gemini with the mission.
- The runner creates a branch using GitHub's built-in workflow token.
- It writes generated files.
- It opens a pull request.

No local machine is required. The phone is just the remote control.
