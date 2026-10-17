export const steps = ['Sources', 'Glue jobs', 'Iceberg', 'Reports'] as const;

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
