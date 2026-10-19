export const pathStages = [
  { id: 'postgres', name: 'Postgres', kicker: 'Source', body: 'Operational tables. A row changes here first.' },
  { id: 'cdc', name: 'CDC', kicker: 'Stream', body: 'The change stream. One run does not mix a full copy with the live stream.' },
  { id: 'raw', name: 'Raw', kicker: 'Iceberg on S3', body: 'Iceberg tables on S3. The source shape, before business rules.' },
  { id: 'glue', name: 'Glue', kicker: 'Transform', body: 'Transform jobs. One shared writer, tenant scope, and a quality check before anyone reads.' },
] as const;

export const pathForks = [
  {
    id: 'dwh',
    name: 'DWH',
    kicker: 'Custom dashboards',
    body: 'Warehouse tables. A person builds a report by picking fields. The demo below reads this layer.',
    report: 'This report queries here',
  },
  {
    id: 'curated',
    name: 'Curated schema',
    kicker: 'Embedded dashboards',
    body: 'Facts and dimensions shaped for a screen that is already inside the product.',
    report: 'Not this demo',
  },
] as const;

export const pathLine =
  'Custom dashboards read the DWH. Embedded dashboards read the curated schema. Both start from the same raw Iceberg tables.';

export const claims = [
  {
    title: 'Shared Iceberg writer',
    body: 'Jobs append, overwrite, or upsert through one writer. A new job inherits it.',
  },
  {
    title: 'Tenant scope on the job',
    body: 'A run includes or excludes organisations. One tenant does not block the others.',
  },
  {
    title: 'Quality checks before BI reads',
    body: 'Freshness, volume, and source-to-lake counts fail the job. The alert points at the run.',
  },
  {
    title: 'Terraform and orchestration',
    body: 'Job definitions are code, scripts deploy to S3, and Step Functions runs the graph. A job is tried in local Docker before AWS.',
  },
];

export const alsoShipped = [
  'Postgres CDC into Iceberg. Publications, slots, and LSN stay consistent. A run does not mix a full refresh with the stream.',
  'Staff reports read the lake through a semantic layer. Organisation and centre scope are applied in the query. The demo above is that field-to-visual loop on synthetic data.',
];
