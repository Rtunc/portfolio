# Personal Portfolio — Data Engineer

## Current Milestone: v1.0 Portfolio Launch

**Goal:** Build and deploy a complete personal portfolio showcasing DE depth through a hybrid 3D experience — immersive Three.js hero + 3D projects section, styled HTML for About/Skills/Contact.

**Target features:**
- Three.js hero scene (data flow / particle network / graph nodes)
- 3D floating project cards (3–4 curated projects)
- About section with DE bio and experience
- Skills section — DE stack + backend
- Contact section — LinkedIn, GitHub, email links
- Deployed to Vercel

## What This Is

A senior Data Engineer's personal portfolio website built with React + Vite + React Three Fiber, deployed on Vercel. Uses a hybrid 3D approach — immersive Three.js hero and 3D project cards, with styled HTML sections for About, Skills, and Contact. Showcases 3–4 curated real projects from the workspace covering ETL/pipelines, data warehouse/lakehouse, and infra. Target audience: recruiters and hiring managers.

## Core Value

First impression that unmistakably communicates "senior DE with strong technical depth" — the 3D data-viz aesthetic IS the proof of skill, not just decoration.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] React + Vite project scaffold with React Three Fiber, TypeScript, Tailwind
- [ ] Three.js hero scene — data flow / particle network / graph nodes aesthetic
- [ ] About section — bio, 5+ years DE experience, career summary
- [ ] 3D projects section — 3–4 curated project cards in 3D space (hover to reveal details)
- [ ] Each project card shows: project name, stack, scale/impact metrics, link to repo
- [ ] Skills section — DE stack (Spark, Airflow, dbt, Kafka, etc.) + backend
- [ ] Contact section — LinkedIn, GitHub, email links (no form)
- [ ] Deployed to Vercel

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
| Hybrid 3D (hero + projects, not all sections) | Achievable v1 scope; hero + projects carry the visual impact | — Pending |
| 3–4 curated projects over comprehensive list | Depth over breadth for recruiter audience; quality > quantity | — Pending |
| Contact as links only (no form) | Zero backend complexity; LinkedIn/GitHub are better channels | — Pending |

---
*Last updated: 2026-04-28 after v1.0 milestone definition*
