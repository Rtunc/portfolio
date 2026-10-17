# Portfolio rebuild — Glue platform and a tryable report

Status: approved in conversation on 2026-10-17. Implementation waits for review of this file.

## Purpose

The public site is a portfolio for recruiters and clients. It says Nguyen Thach Anh owns the Glue lakehouse platform, then lets a visitor run the report loop: choose fields, filter, and see a data table, a pivot, or a chart.

The demo uses a synthetic multi-site fee dataset and DuckDB-WASM in the browser. The site stays a static Vite build on Vercel. No private LittleLives repository is copied or published.

Success: a visitor can explain the platform claim after one scroll, and can change the preset report within a few minutes.

## Decisions

- One route, `/`. Order: Hero, Platform, Report, Also shipped and experience.
- English UI. The music box is not part of the shipped page.
- One widget. Types: data table, pivot, chart. Chart marks: column (default) and line.
- Filters: site (multi-select) and an inclusive month range. They are a bar, not a widget.
- The report opens on Fees by month, split by site, as a column chart.
- Dataset: one generated `fee_lines` table, fixed seed, committed CSV.
- Query: a pure compiler emits SQL. DuckDB-WASM runs it. Pivot totals come from queries over the full filter.
- Display caps: pivot 50 row keys and 12 column keys, table 200 rows, chart 8 series and 50 X values.
- Out of the demo: number card, slicer, sharing, Excel export, multiple tabs, a hosted query API.

## Page

`App` renders one HTML page. There is no WebGL branch and no reduced-motion fork. The report chunk is a dynamic import so the hero bundle does not include DuckDB.

| Section | Content |
|---|---|
| Hero | Name, title, one-sentence claim, location, email, GitHub, LinkedIn, availability. A link points at `#report`. |
| Platform | Four ownership claims and a four-step diagram: Sources, Glue jobs, Iceberg, Reports. |
| Report | One sentence that the builder is the field-to-visual loop on synthetic data, then the builder. |
| Rest | Two short cards (CDC, semantic layer) and the experience timeline. |

The diagram is HTML, not an image. It names no database, cron, or organisation id.

`experiences`, `skillGroups`, and `extras` in `src/data/profile.ts` stay as they are. The six-card `canDo` list is not rendered. Azure and migration remain visible through the experience entries.

### Copy

Hero title: `Data platform engineer`.

Hero summary: `I own the Glue lakehouse platform: the shared writer, tenant-scoped jobs, quality checks, and the deploy path.`

Availability stays: `Open for a second contract — lakehouse, CDC, Glue, DQ`.

Platform claims:

1. Shared Iceberg writer. Jobs append, overwrite, or upsert through one writer. A new job inherits it.
2. Tenant scope on the job. A run includes or excludes organisations. One tenant does not block the others.
3. Quality checks before BI reads. Freshness, volume, and source-to-lake counts fail the job. The alert points at the run.
4. Terraform and orchestration. Job definitions are code, scripts deploy to S3, and Step Functions runs the graph. A job is tried in local Docker before AWS.

Also shipped:

- CDC. `Postgres CDC into Iceberg. Publications, slots, and LSN stay consistent. A run does not mix a full refresh with the stream.`
- Semantic layer. `Staff reports read the lake through a semantic layer. Organisation and centre scope are applied in the query. The demo above is that field-to-visual loop on synthetic data.`

The page claims ownership of the Glue platform repo. It does not claim ownership of the LittleLives product, and it does not claim authorship of the original Report, Tab, and Widget redesign. Case-study markdown files in the repo stay. They are not the page.

### Music box

The home page does not mount the music box. Delete Three.js, React Three Fiber, and drei from the app dependencies, and delete source files that only the music box reaches. Move `public/models` to `models/` at the repo root so the clay assets stay in the repo and Vite does not serve them. Keep `tools/make_musicbox_assets.py`.

## Builder

Desktop layout: field list, then wells and filters, then the visual. Narrow layout: the field list sits behind a `Fields` button. Closing the drawer does not change the query. Drag a field onto a well with browser drag-and-drop events, or press a field button to add it. No drag library. The button path is what keyboard and phone users get.

The visual opens with a skeleton and the status `Loading the demo data.` Wells are editable while DuckDB loads. The edited state is queried once the connection is ready.

Remove control on every placed field. A field lives in one well. Adding it again moves it. Order inside a well is the order of insertion. This version has no reorder gesture.

### Wells

| Type | Wells | Result |
|---|---|---|
| Data table | Columns | Group by each dimension. Aggregate each measure. |
| Pivot | Rows, Columns, Values | A grid, plus row totals, column totals, and a corner total. |
| Chart | X, Y, Series | Column marks by default. A control switches the mark to line. Fields stay. |

The field list is grouped Time, Dimensions, then Measures. A dimension well accepts only dimensions and time. A value well accepts only measures. A drop on the wrong kind of well does nothing.

Click-to-add:

- A measure appends to the value well: table Columns, pivot Values, or chart Y.
- A dimension appends to table Columns or pivot Rows.
- On a chart, the first dimension sets X, the second sets Series, and any further dimension is parked in `extras`.

X and Series each hold one dimension. Dropping another dimension onto an occupied X or Series parks the previous occupant in `extras`. "First dimension" means the first dimension in well order, skipping measures.

`amount` offers Sum (default), Average, and Count. `learners` is Count distinct and has no picker. `fees` is Count and has no picker. Aggregation is preserved across type switches.

### Type switch

Switching widget type keeps every field.

| From | To | Placement |
|---|---|---|
| Chart | Table | Columns, in order: X, Series, extras, then measures. |
| Chart | Pivot | Rows: X then extras. Columns: Series, if set. Values: measures. |
| Table | Chart | X is the first dimension. Series is the second. Further dimensions go to extras. Y is the measures. |
| Pivot | Chart | X is the first row dimension. Series is the first column dimension. Remaining dimensions go to extras. Y is the values. |
| Table | Pivot | If there are two or more dimensions, the last one becomes Columns and the earlier ones become Rows. One dimension stays on Rows. Measures become Values. |
| Pivot | Table | Columns, in order: row dimensions, column dimensions, extras, then measures. |

Empty wells after a switch are empty. Parked extras reappear when the target type can show them.

### Preset

| Piece | Value |
|---|---|
| Widget | chart |
| Mark | column |
| X | `fee_month` |
| Series | `site` |
| Y | `amount`, Sum |
| Sites | all |
| Months | 2024-01 through 2025-06 |

### Filters

Six site checkboxes. An empty selection means all sites, and the SQL has no site predicate. Two month inputs, bounded to 2024-01 and 2025-06. The default range is the full window. `state` swaps a reversed pair in the stored months. `compile` also swaps a reversed pair it receives, so SQL stays inclusive if a caller skips `state`.

### Display caps

Ranking key: the first measure, descending, then the first dimension label, ascending.

| View | Cap |
|---|---|
| Pivot row keys | 50 |
| Pivot column keys | 12 |
| Table rows | 200 |
| Chart series | 8, applied in SQL |
| Chart X values | 50, applied in the shaper |

The grid query for table and pivot returns every aggregated group. This dataset stays small enough. The shaper then keeps the top keys. Chart series are limited in SQL so a learner series does not leave the database.

Truncation uses a caption, including only the caps that fired:

- Table or pivot rows: `Showing first N rows.`
- Pivot columns: `Showing first N columns.`
- Both pivot caps: `Showing first N rows and first N columns.`
- Chart X: `Showing first N values on X.`
- Chart series: `Showing first N series.`

Pivot also shows `Totals cover every fee in this filter.` whenever totals are on screen, including when nothing is truncated. A pivot with no row dimension and no column dimension shows the one grand-total cell and does not repeat it as a totals row.

A pivot cell with no aggregated row is blank. It is not drawn as zero.

## Dataset

One table, `fee_lines`. Generator: `tools/make_demo_fees.mjs`, run with `node tools/make_demo_fees.mjs`. Output: `public/demo/fee_lines.csv`, committed.

Vocabulary, in this order:

- Sites: Harbor, Mill, Orchard, Ridge, Station, Wharf.
- Rooms: Maple, Cedar, Birch, Alder. Every site has all four rooms.
- Learners: 12 per room. 288 learners.
- Programmes, alternating by learner slot in the room: slot 0 is `Weekday care`, slot 1 is `After school`.
- Fee types, every learner-month, in this order: Tuition, Meals, Materials.
- Months: `2024-01-01` through `2025-06-01`, eighteen first-of-month dates.
- Status: `Open` when `(learnerIndex + monthIndex) % 17 === 0`, otherwise `Paid`. Both indexes are zero-based.

Row order: site, room, learner slot, month, fee type. Row count is `6 × 4 × 12 × 18 × 3 = 15552`.

`learner_id` is `L` plus the one-based learner index on four digits, assigned once per learner in site, room, slot order. `L0001` is the first learner. `L0288` is the last.

Learner names come from these lists. For zero-based index `i`, the name is `first[i % 26] + " " + second[floor(i / 26)]`.

- first: An, Bo, Cai, Dee, Eli, Fay, Gia, Ho, Ivy, Jin, Kai, Lee, Mo, Nia, Owen, Pia, Quin, Ren, Sol, Tai, Uma, Vin, Wynn, Xen, Yara, Zed.
- second: Ash, Brook, Cole, Dale, Elm, Frost, Glen, Hart, Isle, Jay, Kirk, Lane.

Amounts are integers:

| Fee type | Amount |
|---|---|
| Tuition | Site base plus programme adder |
| Meals | 120 for Weekday care, 40 for After school |
| Materials | 35 |

Site tuition base: Harbor 900, Mill 800, Orchard 750, Ridge 700, Station 850, Wharf 820. Programme adder on tuition: Weekday care 0, After school −200.

Frozen rows the generator test asserts:

- First: `L0001,An Ash,Harbor,Maple,Weekday care,Tuition,Open,2024-01-01,900`
- Second: `L0001,An Ash,Harbor,Maple,Weekday care,Meals,Open,2024-01-01,120`
- Last: `L0288,Bo Lane,Wharf,Alder,After school,Materials,Paid,2025-06-01,35`

Header:

```text
learner_id,learner,site,room,programme,fee_type,status,fee_month,amount
```

The builder shows `Synthetic. Not a client.` Names, rooms, and sites are fictional. The schema does not reuse LittleLives table names, programme codes, or tenant names.

### Catalog

| Id | Kind | SQL |
|---|---|---|
| `site`, `room`, `programme`, `fee_type`, `status` | dimension | that column |
| `learner` | dimension | `learner` |
| `fee_month` | time | `fee_month` |
| `amount` | measure | `amount`. Sum, Average, or Count. |
| `learners` | measure | `COUNT(DISTINCT learner_id)` |
| `fees` | measure | `COUNT(*)` |

`learner_id` is not a field. Labels on screen: Site, Room, Programme, Fee type, Status, Learner, Month, Amount, Learners, Fees.

## Query

`compile` is a pure function. It does not import DuckDB. Column names enter SQL only from the catalog allow-list. Site names and month bounds are bound parameters. Aggregation is the enum `sum`, `avg`, `count`, or `count_distinct`.

Month strings `YYYY-MM` become the date `YYYY-MM-01` before binding. The predicate is `fee_month >= ? AND fee_month <= ?`, inclusive.

Incomplete states return a reason and no SQL:

| State | Reason |
|---|---|
| Chart with no dimension, including when a measure is also missing | `need-x` |
| Chart with a dimension and no measure | `need-y` |
| Pivot with no measure | `need-value` |
| Table with no field | `need-column` |
| Pivot with measures and no dimension | valid, one cell |

Guidance copy for those reasons: `Add a field to X.`, `Add a field to Y.`, `Add a field to Values.`, `Add a field to Columns.`

### SQL shape

Table and pivot grid:

```sql
SELECT <dimensions>, <aggregates>
FROM fee_lines
WHERE <filters>
GROUP BY <dimensions>
```

Omit `GROUP BY` when there is no dimension. Aggregate aliases use the field id and the aggregation, so the shaper can find each column.

Chart with a series field ranks the series by the sum of the first measure, keeps 8, and orders X ascending. Time on X sorts chronologically. The preset compiles to a grouped set of `fee_month`, `site`, and `SUM(amount)`, a ranked `site` set with `LIMIT 8`, and a join back to that set. The preset binds `2024-01-01` and `2025-06-01` and has no site predicate.

Chart with no series field omits the ranking query.

### Pivot totals

Totals are separate statements with the same `WHERE` as the grid. They aggregate the full filter.

| Query | When | Grouping |
|---|---|---|
| Grand total | every pivot | none |
| Column totals | at least one column dimension | column dimensions only |
| Row totals | at least one column dimension | row dimensions only |

With no column dimension, the grid cell is the row total, and only the grand total is queried. Average is the average over the filtered rows. Count distinct is the distinct count over the filtered rows. The shaper does not add up visible cells to produce a total.

### Engine

`engine.ts` is loaded only from the report chunk.

Instantiate `@duckdb/duckdb-wasm` with Vite `?url` imports of the mvp and eh wasm modules and their workers. `selectBundle` picks the bundle. Do not use the coi build, and do not load the library from a CDN. One worker, one connection. Queries run on a single queue.

Fetch `fee_lines.csv` once, register the bytes on the worker, and create `fee_lines`. After load, `fee_month` is a DATE and `amount` is a DOUBLE. The other columns are VARCHAR. If a required column is missing, or those types cannot be read, the load fails.

Each run takes a token. The engine keeps the latest token. A result whose token is no longer latest is discarded and does not paint. While the connection is loading, state changes wait and one query runs when the connection becomes ready.

An error boundary wraps the report section. A render throw shows the load-failure message and Retry. Retry on a load failure instantiates again. Retry on a query failure runs the current state again.

### Formatting

Integers render with thousands separators and no decimal part. An average renders with up to two decimal places and trailing zeros removed. Count measures render as integers.

## Errors

The visual is the only place a demo failure appears. Hero and Platform do not read its state.

| Situation | Copy | Live region | SQL |
|---|---|---|---|
| Missing field | the guidance sentence for the reason | `status` | not run |
| Zero rows | `No fees match this filter.` | `status` | ran |
| WASM, CSV, or schema failed | `This demo couldn't load.` plus `Retry` | `alert` | no connection |
| Query threw | `This view couldn't be calculated.` plus `Retry` | `alert` | ran |
| A cap fired | the truncation caption | `status` | ran |

The query-failure path does not print SQL on the page. A failed load does not invent numbers.

## Modules

| Path | Responsibility |
|---|---|
| `src/data/profile.ts` | Update title and summary. Leave availability, `experiences`, `skillGroups`, and `extras` unchanged. |
| `src/data/platform.ts` | Claims, diagram labels, also-shipped cards. |
| `src/components/Hero.tsx`, `Platform.tsx`, `Experience.tsx` | The static sections. |
| `src/components/ReportDemo.tsx` | Layout, wells, filters, visual. Lazy from `App`. |
| `src/demo/catalog.ts` | Field allow-list. |
| `src/demo/state.ts` | Preset, click-to-add, drag placement, remove, type switch. |
| `src/demo/compile.ts` | State to SQL and parameters, or a reason code. |
| `src/demo/shape.ts` | Long rows to a table, a pivot grid, or chart series. Applies the client caps. |
| `src/demo/engine.ts` | DuckDB connection, token queue, schema check. |
| `src/demo/fixtures/fees_tiny.csv` | Hand-written engine fixture. |
| `public/demo/fee_lines.csv` | Generated dataset. |
| `tools/make_demo_fees.mjs` | Generator. |
| `package.json` | Add `@duckdb/duckdb-wasm`, Vitest, and Testing Library. Remove the Three.js packages. Script `demo:data`. |

## Tests

Add Vitest and Testing Library. `pnpm test`, `pnpm typecheck`, and `pnpm build` all pass.

| Group | What it locks |
|---|---|
| Generator | Running it reproduces 15552 rows, the header, the first row, the second row, and the last row. Every `amount` is a finite number. Every `learner_id` is non-empty. Every `fee_month` is inside the eighteen-month window. The committed CSV matches that output. |
| `compile` | The preset groups `fee_month` and `site`, sums `amount`, binds the two month dates, and has no site predicate. Its series clause keeps eight sites. An empty site list adds no predicate. A reversed month range is swapped before SQL. `learners` compiles to `COUNT(DISTINCT learner_id)`. An unknown field id throws before SQL. Each incomplete state returns the reason in the table above and no SQL. A measure-only pivot returns SQL. |
| `shape` | Long rows become a grid. A missing combination is blank. Caps of 50 and 12 raise the caption flag. The corner total is the grand-total result. A fixture where the visible cells would average to a different number still shows the grand-total average. |
| `state` | Each row of the type-switch table, with a fixed example. Click-to-add lands in the well named above. An empty site list and a swapped month range normalize as specified. |
| Engine, fake executor | A late result for token A does not replace a painted result for token B. |
| Engine, real DuckDB | `compile` builds the Harbor / 2024-01 query. `engine.ts` loads `fees_tiny.csv` and runs that SQL. `SUM(amount)` is 170, `COUNT(*)` is 3, and `COUNT(DISTINCT learner_id)` is 2. |
| React | The hero heading renders with the engine module mocked out. The preset path shows a chart frame. A `need-x` result shows `Add a field to X.` A load error shows `Retry`. |

`fees_tiny.csv` contents:

```text
learner_id,learner,site,room,programme,fee_type,status,fee_month,amount
L0001,An Ash,Harbor,Maple,Weekday care,Tuition,Paid,2024-01-01,100
L0001,An Ash,Harbor,Maple,Weekday care,Meals,Paid,2024-01-01,20
L0002,Bo Brook,Harbor,Maple,After school,Tuition,Paid,2024-01-01,50
L0003,Cai Cole,Mill,Maple,Weekday care,Tuition,Paid,2024-02-01,80
L0001,An Ash,Harbor,Maple,Weekday care,Tuition,Paid,2024-02-01,100
L0002,Bo Brook,Mill,Maple,After school,Meals,Open,2024-02-01,40
```

Harbor in January is the first three rows: 100 + 20 + 50 = 170, three fees, two learners.

Component tests mock `engine.ts`. They do not boot WASM.

## Manual check

After the automated tests pass, open the dev server and do this in a browser:

1. Hero text is visible before the report finishes loading.
2. The preset chart draws fees by month with one series per site.
3. Switch to pivot and to table. The month, site, and amount fields are still there.
4. Clear sites, then select one site. The numbers change. Clear the selection again and the full set returns.
5. Remove every field. The visual shows the matching guidance sentence.
6. Narrow the viewport until Fields becomes a button, open it, and add a field.

## Out of scope

Number cards, slicers, report sharing, Excel export, and more than one widget. A Node query server or Cube. Publishing Glue, Cube, sv-backend, or sv-frontend. Production database names, crons, organisation ids, and any percentage that is not measured in this repo. Reordering fields by dragging them inside a well.

## Done when

The static page shows the claim and the experience, the demo runs the preset and the three widget types against the synthetic CSV, the tests in this spec pass, and the manual check has been done in a browser.
