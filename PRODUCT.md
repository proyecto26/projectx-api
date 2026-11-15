# Product

## Platform

API (HTTP + Temporal); no frontend

## Users

**Primary:** TypeScript-fluent indie founders and small engineering teams (1–6 people) starting a backend for a real product. They've shipped before, have opinions about their stack, and have personally lived through wiring NestJS + Prisma + Temporal + auth from scratch. They would rather fork an opinionated baseline than spend a week on plumbing. They are evaluating a year-long bet in under an hour.

**Secondary:** Engineers moving from "a single Express app with cron jobs" to "an API with durable workflows" who want a reference project that is not a toy, and teams that already have a frontend and need the backend.

**The job:** "Decide in 20 minutes whether this saves me a month of setup, and if yes, fork it tonight and have my first domain workflow running by Friday."

## Product Purpose

ProjectX API is an open-source (MIT, Proyecto 26) TypeScript template for building a backend with NestJS and Temporal. It ships a wired, working baseline with no domain in it: one NestJS app (`apps/api`) with passwordless email login run as a Temporal workflow, JWT, users and role-based access control, health checks, Swagger, Prisma/PostgreSQL, and SendGrid/MJML email, all in one Turborepo. The domain is the forker's: generators add modules and workflows that are wired and tested.

Success: an evaluator understands the architecture and trusts it within one sitting, then forks it and ships their own module and workflow on top of it.

## Positioning

The API-only sibling of ProjectX (the full-stack e-commerce template). Where ProjectX demonstrates a business flow end to end, ProjectX API removes everything domain-specific and keeps what every backend needs: auth that works, RBAC enforced on every request, a Temporal worker and client set up correctly in-process, readiness that reflects Temporal, and generators that respect the activity registration contract (`pnpm gen:module`, `pnpm gen:workflow`, checked in CI by `pnpm test:generators`). It also ships the visual Temporal workflow playground and first-class AI-agent integration (Claude/Cursor/Codex skills, subagents, MCP servers). The Temporal wrapper, `@proyecto26/temporal-workflows`, is consumed from npm and developed in ProjectX, so both templates share one implementation.

## Operating Context

- **Evaluation:** found on GitHub (README), read critically on desktop beside an IDE. Evaluators expect real code, real architecture, and no filler.
- **Development:** the Temporal UI (:8080), Swagger (:8081/swagger) and the Temporal playground (`pnpm playground`, :4343) in long, IDE-adjacent sessions.
- **Local stack:** `docker compose up -d` (PostgreSQL + PostGIS, Elasticsearch, Temporal server + UI, namespace provisioning, builder, api) or the infrastructure in Docker and `pnpm dev:api` on the host. Emails print to the logs when `SENDGRID_API_KEY` is empty in development.

## Capabilities and Constraints

- **Surfaces:** the HTTP API (`/auth/login`, `/auth/verify-code`, `/auth/user`, admin-only `/auth/users`, `/health`, Swagger), the Temporal workflows, the CLI and generators, MJML email templates, the README/docs, and the Temporal playground (`.agents/skills/temporal-playground`).
- **Backend:** one NestJS app; the login workflow is the only workflow shipped and the reference for new ones. Roles `admin` and `user`; permissions exist as schema only.
- **No domain:** no products, orders or payments. Examples in docs and generators use neutral names and must stay easy to delete.
- **Terminology:** workflow, activity, signal, query, update, durable execution, and worker are Temporal terms of art and should be used precisely.

## Brand Commitments

- **Name:** ProjectX, by Proyecto 26. The logo exists as a README asset (GitHub user-attachments).
- **Personality:** *opinionated, workmanlike, generous.*
  - Opinionated: make the stack decisions and own them. Don't hedge with "or swap this for X."
  - Workmanlike: boring-in-the-best-sense tools, wired cleanly. Craft lives in the seams (generators, types, migrations), not in surface pyrotechnics.
  - Generous: ships far more than OSS usually does. It's a gift, not a funnel.
- **Voice:** unhurried, technical, welcoming. No consulting-brochure language ("empower," "next-generation," "seamlessly integrates"), no urgency tactics, no talking down to newcomers. Explain the why and show the escape hatch when one exists.
- **Funding:** free and open source, supported by GitHub Sponsors (https://github.com/sponsors/proyecto26) and the Proyecto 26 sponsorship program.

## Evidence on Hand

- The real codebase: the API, the login workflow, RBAC, generators (and their CI check), CLI and playground are all demonstrable with real code.
- `README.md` (feature list, "Why Temporal," quick start, auth flow, generators); `docs/architecture` (README, INFRASTRUCTURE), `docs/backend` (README, DATABASE, RULES, TEMPORAL).
- Curated external learning links: the Temporal TypeScript public courses listed in the README.
- **Absent, never fabricate:** testimonials, named adopters or customer logos, usage or download numbers, benchmarks, and pricing (there is none; it's MIT).

## Product Principles

1. **Code before copy.** Real code, types, and architecture are the proof. Prose frames code and never replaces it.
2. **Commit, explain, show.** Every stated opinion comes with a one-line why and a concrete code sample or diagram of how.
3. **Respect the reader's time and intelligence.** Say it once, say it well. Any sentence that could appear on any SaaS landing page gets deleted.
4. **Generic where forkers replace, opinionated where they inherit.** Example content (the login workflow's email copy, sample names in generated code) stays easy to swap. Architecture, tooling, and conventions are the product and are stated with conviction.
5. **Durable, not trending.** The template will be forked for years. Choose what will still read as correct in three.

## Accessibility & Inclusion

- Docs and error messages in plain English; no jargon beyond the Temporal terms of art.
- Code samples copy-paste ready, with the command to run them.
- API errors use standard HTTP status codes (401 unauthenticated, 403 missing role) with readable messages.
