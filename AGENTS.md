Basketball Player Registration

Business Requirements
 - An MVP of a basketball player session registration application as a web app
 - The web app should have 1 page 
 - The page should list all registered players as a table
 - Each row in the table should show some player details and enable edits
 - Add new sessions and players to each session
 - Allow filter for players and sessions by year and month
 - No more functionality: no archive, no search.  Keep it simple
 - The priority is a clean UI using React Shadcn
 - The appplication should open with sample data poplulaing a single session in 2026 with 10 registered players
- Ability to manage players and sessions

Technical Details
1. Single page to show all registered players in a table
2. Actions: Add players with a simiple form, edit player details and enalbe players to select from different sessions to register for
3. Tech: Next.js app frontend, client-rendered, no-persistence, no auth
Quality: scaffolding + unit test per phase; Playwright E2E

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
