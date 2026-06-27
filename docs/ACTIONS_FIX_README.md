# Action Build Repair

Changes in this branch repair the GitHub Actions setup and build path.

- Use setup-node plus Corepack instead of pnpm/action-setup.
- Install React and Node type packages.
- Generate Prisma client during API build and typecheck.
- Use JSON storage for memory embedding in CI-friendly schema.
