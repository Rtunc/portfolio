# Roadmap: Personal Portfolio — Data Engineer

## Overview

Five phases from blank repo to live Vercel deployment. Phase 1 establishes the working scaffold. Phase 2 delivers the hero — the visual centerpiece that communicates technical identity. Phase 3 builds the 3D project showcase. Phase 4 fills the content sections and ensures the page scrolls as one coherent experience. Phase 5 ships the site publicly and ensures it presents well when shared.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Project Scaffold** - React + Vite + TypeScript + Tailwind + R3F configured and rendering in browser
- [ ] **Phase 2: Three.js Hero Scene** - Immersive animated hero with data-viz aesthetic, identity text, and lazy-loaded 3D
- [ ] **Phase 3: 3D Projects Section** - Interactive 3D project cards with hover effects and real repo links
- [ ] **Phase 4: Content Sections** - About, Skills, Contact sections with frictionless scroll through full page
- [ ] **Phase 5: Polish & Deploy** - Live on Vercel with proper meta tags for sharing

## Phase Details

### Phase 1: Project Scaffold
**Goal**: A working React + Three Fiber project renders in the browser with all required dependencies configured
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` starts the dev server and opens a React page in the browser without errors
  2. TypeScript compiles cleanly — no type errors on the baseline scaffold
  3. Tailwind CSS utility classes apply correctly to rendered elements
  4. A React Three Fiber Canvas mounts and renders a basic 3D primitive (confirms R3F + drei are wired correctly)
  5. The site renders correctly in Chrome, Firefox, and Safari
**Plans**: TBD

### Phase 2: Three.js Hero Scene
**Goal**: Visitors see a fullscreen animated data-viz scene that immediately communicates technical identity, with identity text overlaid and 3D loaded without blocking paint
**Depends on**: Phase 1
**Requirements**: HERO-01, HERO-02, HERO-03, HERO-04, EXP-03
**Success Criteria** (what must be TRUE):
  1. On page load, a fullscreen Three.js scene fills the viewport — particle network, graph nodes, or flowing data streams are visible
  2. The scene animates continuously without user interaction — particles move, connections pulse
  3. The engineer's name, "Data Engineer" title, and a scroll/explore CTA are visible overlaid on the scene
  4. The hero runs at 60fps on mid-range hardware with no layout jank or input blocking
  5. The 3D Canvas is lazy-loaded — initial HTML paint is not blocked by WebGL initialization
**Plans**: TBD

### Phase 3: 3D Projects Section
**Goal**: Visitors can browse 3–4 curated project cards arranged in 3D space and interact with them to reveal details and reach the real repos
**Depends on**: Phase 2
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04
**Success Criteria** (what must be TRUE):
  1. 3–4 project cards are visible arranged in 3D space below the hero
  2. Each card displays the project name, tech stack, and a scale/impact metric (e.g., "10TB/day", "3x faster ETL")
  3. Hovering a card triggers a clear visual response — glow, float, or detail panel reveal
  4. Each card has a working link that navigates to the real source repo or artifact
**Plans**: TBD

### Phase 4: Content Sections
**Goal**: Visitors can learn who the engineer is, what tools they use, and how to reach them — with a smooth scroll connecting all sections into one coherent page
**Depends on**: Phase 3
**Requirements**: CONT-01, CONT-02, CONT-03, EXP-01
**Success Criteria** (what must be TRUE):
  1. An About section is visible with a DE bio and career summary that references 5+ years of experience
  2. A Skills section lists the DE stack (Spark, Airflow, dbt, Kafka, Python, SQL) and backend capabilities
  3. A Contact section shows LinkedIn, GitHub, and email links that open correctly
  4. Scrolling from the hero through Projects → About → Skills → Contact is smooth with no layout breaks or scroll friction
**Plans**: TBD

### Phase 5: Polish & Deploy
**Goal**: The portfolio is publicly accessible on Vercel and presents correctly when shared or discovered
**Depends on**: Phase 4
**Requirements**: FOUND-03, EXP-02
**Success Criteria** (what must be TRUE):
  1. A public Vercel URL returns the portfolio — fully functional, no build errors in production
  2. The browser tab shows a meaningful page title (not the Vite default)
  3. Sharing the URL on Slack, iMessage, or LinkedIn renders an OG preview card with title, description, and image
  4. `<meta name="description">` and basic Open Graph tags are present in the page source
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold | 0/TBD | Not started | - |
| 2. Three.js Hero Scene | 0/TBD | Not started | - |
| 3. 3D Projects Section | 0/TBD | Not started | - |
| 4. Content Sections | 0/TBD | Not started | - |
| 5. Polish & Deploy | 0/TBD | Not started | - |
