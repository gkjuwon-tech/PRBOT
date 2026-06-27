# Actions fix notes

This branch fixes the first wave of GitHub Actions failures.

## Fixed

- Removed `pnpm/action-setup` from workflows and switched to Corepack-managed pnpm.
- Removed pnpm cache configuration that can fail before pnpm is available.
- Added React type packages for the web app build.
- Added Node type packages for the API build.
- Made the Prisma memory embedding field portable for CI by using JSON storage instead of a database-specific vector type.
- Switched CI Postgres service to the stock Postgres image for a lighter first-pass build.

## Why

The failing workflow stopped at pnpm setup before install/typecheck/build could run. The new workflow setup is intentionally boring and stable: setup Node, enable Corepack, prepare pnpm, install, then build.
