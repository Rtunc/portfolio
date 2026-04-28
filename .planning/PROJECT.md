# Personal Portfolio — Data Engineer

## What This Is

A senior Data Engineer's personal portfolio website built with React + Vite + Three.js, deployed on Vercel. The site is fully interactive in 3D — users navigate through sections via Three.js scenes with data visualization aesthetics (graph nodes, flowing data, network connections). It showcases real projects from the workspace covering ETL/pipelines, data warehouse/lakehouse, data infrastructure, backend/API work, and migration engineering. Target audience: recruiters and hiring managers.

## Core Value

First impression that unmistakably communicates "senior DE with strong technical depth" — the 3D data-viz aesthetic IS the proof of skill, not just decoration.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Hero section with immersive Three.js 3D scene (data flow / graph nodes / particle network)
- [ ] About section — 5+ years DE experience, skills overview
- [ ] Projects section — showcase real projects from workspace (ETL, DW/lakehouse, infra, backend/API, migrations)
- [ ] Skills section — DE stack (Spark, Airflow, dbt, Kafka, etc.) + backend capabilities
- [ ] Each project card shows: stack used, scale/impact metrics, and links to real code
- [ ] Interactive 3D navigation between sections (scroll or click triggers scene transitions)
- [ ] Contact section
- [ ] Deployed to Vercel with custom domain support

### Out of Scope

- Blog / article system — adds CMS complexity, not core to recruiter goal
- Dark/light mode toggle — data viz aesthetic locked to dark; toggle breaks visual identity
- i18n / multi-language — EN only for recruiter audience
- Backend API — static site, no server needed

## Context

- **Workspace**: Real project code exists in the workspace and will be referenced/linked from portfolio
- **DE expertise areas**: ETL/data pipelines, data warehouse & lakehouse design, data engineering infrastructure, backend development, API-based migrations
- **Three.js approach**: React Three Fiber (r3f) + @react-three/drei for React integration — avoids manual animation loop management
- **Aesthetic**: Data visualization vibes — graph nodes, network connections, flowing data streams — dark background with glowing accents
- **Deployment**: Vercel (zero-config for Vite projects)

## Constraints

- **Tech stack**: React + Vite + Three.js (React Three Fiber) — decided
- **Hosting**: Vercel — decided
- **Performance**: WebGL scene must not block interactivity; lazy load 3D sections
- **SEO**: Basic meta tags sufficient (recruiters arrive via direct link, not organic search)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Three Fiber over raw Three.js | Declarative 3D in React, lifecycle management, huge ecosystem | — Pending |
| React + Vite over Next.js | No SSR needed for static portfolio; faster dev iteration | — Pending |
| Data viz aesthetic (not minimal/cyberpunk) | Directly communicates DE identity without words | — Pending |
| Full-page 3D interactive (not hero only) | Differentiates from typical portfolio; showcases frontend depth | — Pending |

---
*Last updated: 2026-04-28 after initialization*
