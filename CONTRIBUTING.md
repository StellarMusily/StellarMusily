# Contributing to Tempo

Thanks for helping people learn music! 🎶

1. Pick an issue (look for `good first issue`) and comment that you're taking it.
2. Fork, then create a branch: `feat/short-description` or `fix/short-description`.
3. Keep PRs small and focused. Add or update tests.
4. Before opening a PR, make sure these pass:
   ```bash
   cd contracts && cargo fmt --check && cargo test
   cd backend && npm test
   cd frontend && npm run build
   ```
5. Describe what changed and how you tested it. Add a screenshot for UI changes.

## Code style
- **Rust:** `cargo fmt`, no `unwrap()` in contract code paths; return `Error` variants instead.
- **JS/TS:** keep game logic pure in `backend/src/gamification.js` so it stays easy to test.

## Questions
Open a GitHub Discussion or ask in the issue.
