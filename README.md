# PRBOT

Initial repository anchor for HN Cloud PR Agent.

## Overview
This workspace houses the **HN Cloud PR Agent**, a lightweight web application coupled with a GitHub Actions workflow that enables continuous repository tasks and pull request orchestration right from your phone or browser.

### Core Features
- **Client-Side Triggering**: Communicates directly with GitHub's dispatch APIs from your browser.
- **Gemini-Powered Agents**: Utilizes Google's Gemini models for robust code modification, planning, and test coordination.
- **State Retention**: State, memory, and next action items are preserved across runs using a stable `Job ID` stored in the repository branch.
- **Robust Credentials Security**: All sensitive keys remain localized within the React application, with opt-in storage in browser `localStorage`.