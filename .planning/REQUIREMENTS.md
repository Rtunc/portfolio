# Requirements: Personal Portfolio — Data Engineer

**Defined:** 2026-04-29
**Core Value:** First impression that unmistakably communicates "senior DE with strong technical depth" — the 3D data-viz aesthetic IS the proof of skill, not just decoration.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: Project scaffold exists with React + Vite + TypeScript + Tailwind CSS + React Three Fiber + @react-three/drei
- [ ] **FOUND-02**: Site renders correctly in modern browsers (Chrome, Firefox, Safari)
- [ ] **FOUND-03**: Site is deployed to Vercel and publicly accessible

### Hero

- [ ] **HERO-01**: Visitor sees a fullscreen Three.js scene on load — particle network / graph nodes / flowing data streams
- [ ] **HERO-02**: Scene animates continuously (particles move, connections pulse)
- [ ] **HERO-03**: Hero displays name, title ("Data Engineer"), and a scroll/explore CTA
- [ ] **HERO-04**: Hero scene is performant (60fps on mid-range hardware, no layout jank)

### Projects

- [ ] **PROJ-01**: Visitor sees 3–4 project cards arranged in 3D space
- [ ] **PROJ-02**: Each project card shows: project name, tech stack, scale/impact metric
- [ ] **PROJ-03**: Each card links to the real source repo or relevant artifact
- [ ] **PROJ-04**: Cards respond to hover (visual feedback — glow, float, reveal detail)

### Content

- [ ] **CONT-01**: About section — DE bio with 5+ years experience and career summary
- [ ] **CONT-02**: Skills section — DE stack (Spark, Airflow, dbt, Kafka, Python, SQL) + backend capabilities
- [ ] **CONT-03**: Contact section — LinkedIn, GitHub, and email links visible and functional

### Experience

- [ ] **EXP-01**: User can scroll from hero through all sections without friction
- [ ] **EXP-02**: Site has appropriate meta tags (title, description, og:image) for when shared
- [ ] **EXP-03**: 3D sections are lazy-loaded — don't block initial paint

## v2 Requirements

### Enhancements

- **ENH-01**: Interactive 3D transitions between sections (fly-through navigation)
- **ENH-02**: Blog / writing section
- **ENH-03**: Case study deep-dive pages per project
- **ENH-04**: Dark/light theme toggle

## Out of Scope

| Feature | Reason |
|---------|--------|
| Blog / article system | Adds CMS complexity; not core to recruiter goal |
| Dark/light mode toggle | Data viz aesthetic locked to dark; toggle breaks visual identity |
| i18n / multi-language | EN only for recruiter audience |
| Backend API / contact form | Static site; LinkedIn/GitHub are better contact channels |
| 8+ projects | Breadth over depth hurts recruiter impression; 3–4 curated is stronger |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 5 | Pending |
| HERO-01 | Phase 2 | Pending |
| HERO-02 | Phase 2 | Pending |
| HERO-03 | Phase 2 | Pending |
| HERO-04 | Phase 2 | Pending |
| EXP-03 | Phase 2 | Pending |
| PROJ-01 | Phase 3 | Pending |
| PROJ-02 | Phase 3 | Pending |
| PROJ-03 | Phase 3 | Pending |
| PROJ-04 | Phase 3 | Pending |
| CONT-01 | Phase 4 | Pending |
| CONT-02 | Phase 4 | Pending |
| CONT-03 | Phase 4 | Pending |
| EXP-01 | Phase 4 | Pending |
| EXP-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 — traceability confirmed after roadmap creation*
