AGENTS.md

Project Overview

Shifty Player Platform is a web application designed to help youth sports organizations manage players, programs, registrations, and payments.

Technology Stack

* Frontend: React
* Backend: Node.js
* Database: MongoDB
* Payments: Stripe
* Source Control: GitHub

General Rules

1. Keep it simple. Prefer straightforward solutions over complex implementations.
2. Understand before changing. Review existing code, architecture, and dependencies before making modifications.
3. Follow existing patterns. Reuse established components, utilities, APIs, and conventions.
4. Make minimal changes. Only modify files necessary to complete the requested task.
5. Avoid unnecessary dependencies. Do not introduce new libraries unless clearly justified.
6. Preserve existing functionality. Do not break working features or change unrelated behavior.
7. Ask when unclear. If requirements are ambiguous or a change could affect important functionality, request clarification.

Development Guidelines

Frontend — React

* Reuse existing components when possible.
* Follow established styling and component patterns.
* Keep components small and maintainable.
* Handle loading, empty, and error states.

Backend — Node.js

* Follow existing API and service patterns.
* Keep business logic separate from routing when practical.
* Validate incoming data.
* Handle errors consistently.

Database — MongoDB

* Follow existing schema and model conventions.
* Avoid unnecessary schema changes.
* Do not delete or modify production data without explicit approval.

Payments — Stripe

* Preserve existing payment and subscription workflows.
* Never expose API keys or sensitive payment information.
* Do not modify payment processing logic without explicit approval.

Planning and Implementation

For small changes:

1. Identify the relevant code.
2. Implement the smallest reasonable solution.
3. Run applicable tests.
4. Summarize the changes.

For larger features:

1. Analyze the relevant architecture.
2. Create an implementation specification.
3. Identify affected files, dependencies, and risks.
4. Wait for approval before implementing.
5. Implement the approved changes.
6. Run applicable tests and report results.

Testing

* Add or update tests when changing behavior.
* Run existing relevant tests before completing a task.
* Do not claim tests passed unless they were executed successfully.
* Report any tests that could not be run.

Security

* Never hardcode credentials, API keys, or secrets.
* Use existing environment variable conventions.
* Protect player and customer information.
* Follow existing authentication and authorization patterns.
* Do not expose sensitive data in logs.

Git and Code Changes

* Keep changes focused on the requested task.
* Do not refactor unrelated code.
* Do not overwrite or discard existing work.
* Do not commit or push changes unless explicitly requested.

Communication

After completing a task, provide:

1. A brief summary of what changed.
2. The files modified.
3. Tests performed and their results.
4. Any outstanding issues or recommendations.

Guiding Principle: Favor simplicity, maintainability, security, and minimal changes over unnecessary complexity.