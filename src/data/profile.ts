export const profile = {
  name: 'Nguyen Thach Anh',
  shortName: 'Thach Anh',
  title: 'Data platform engineer',
  location: 'Hanoi, Vietnam · remote',
  email: 'nta.thachanh@gmail.com',
  github: 'https://github.com/Rtunc',
  linkedin: 'https://www.linkedin.com/in/ntanta',
  availability: 'Open for a second contract — lakehouse, CDC, Glue, DQ',
  summary:
    'I own the Glue lakehouse platform: the shared writer, tenant-scoped jobs, quality checks, and the deploy path.',
};

export const canDo = [
  {
    code: '01',
    title: 'Postgres CDC → Iceberg',
    detail:
      'Publications, slots, LSN, batched rollouts. No mix of full_refresh + CDC in one run. Land in Iceberg so Athena still reads after schema drift.',
    stack: ['Postgres', 'CDC', 'Iceberg', 'S3', 'Athena'],
  },
  {
    code: '02',
    title: 'Glue / Spark job framework',
    detail:
      'Reusable Iceberg writer (append / overwrite / MERGE), tenant-scoped jobs, partition-spec checks at write, compaction and snapshot expiry as scheduled jobs.',
    stack: ['AWS Glue', 'Spark', 'Iceberg', 'Terraform'],
  },
  {
    code: '03',
    title: 'DQ that catches empty T-1 reports',
    detail:
      'Freshness on etl_timestamp, not business_date. fail_zero, same-DOW volume bands, source-vs-lake counts. Slack with the Glue run URL before the dashboard refresh.',
    stack: ['Python', 'Athena', 'EventBridge', 'Slack'],
  },
  {
    code: '04',
    title: 'Orchestrate and alert',
    detail:
      'Step Functions, EventBridge, Lambda, SQS. Glue 6 / Spark 4 runtime upgrades. IaC for S3, IAM, Glue. Jobs that fail loud instead of going green empty.',
    stack: ['Step Functions', 'Lambda', 'Terraform', 'GitLab CI'],
  },
  {
    code: '05',
    title: 'Azure streaming analytics',
    detail:
      'Event Hub → ADF → ADLS Gen2 → Power BI. ~400K records/hour retail behavior pipeline; cut report latency ~70% and compute cost ~40% with dynamic allocation.',
    stack: ['Event Hub', 'ADF', 'ADLS', 'Power BI'],
  },
  {
    code: '06',
    title: 'Migrate by reading the backend',
    detail:
      'V1 → V2: map source tables from application code, validate contracts, move tenants without silent downstream breakage. Edge is BE + data, not SQL-only.',
    stack: ['Python', 'Postgres', 'SQL', 'FastAPI'],
  },
];

export const skillGroups = [
  {
    name: 'Lakehouse',
    skills: ['AWS Glue', 'Apache Spark', 'Apache Iceberg', 'Athena', 'S3', 'Parquet', 'MERGE / upsert'],
  },
  {
    name: 'Ingest & CDC',
    skills: ['Postgres CDC', 'JDBC', 'Azure Event Hub', 'Kafka', 'Lambda', 'Python ETL'],
  },
  {
    name: 'Orchestrate',
    skills: ['Step Functions', 'Airflow', 'EventBridge', 'SQS', 'Azure Data Factory', 'GitLab CI'],
  },
  {
    name: 'Quality & ops',
    skills: ['Freshness DQ', 'fail_zero', 'same-DOW volume', 'Slack alerts', 'Azure Monitor'],
  },
  {
    name: 'Cloud & IaC',
    skills: ['AWS', 'Azure', 'Terraform', 'CloudFormation', 'IAM', 'Docker'],
  },
  {
    name: 'Languages & stores',
    skills: ['Python', 'SQL', 'JavaScript', 'PostgreSQL', 'MySQL', 'SQL Server', 'FastAPI'],
  },
];

export const experiences = [
  {
    role: 'DataOps Engineer',
    company: 'LittleLives',
    period: 'Dec 2025 — present',
    location: 'Vietnam',
    highlights: [
      'Built the AWS Glue job repo from scratch: modules, standards, deploy path.',
      'Iceberg lakehouse raw → curated → consumption; MERGE incremental loads.',
      'Postgres CDC into Iceberg; DQ and Terraform for S3 / IAM / Glue.',
    ],
  },
  {
    role: 'Data Engineer',
    company: 'Alphaway · Techcombank onsite',
    period: 'Jul 2025 — Nov 2025',
    location: 'Vietnam',
    highlights: [
      'Credit-delay and credit-limit ETL for a debt-collection voicebot.',
      'Sourcing jobs on the bank data platform; S3 via Terraform.',
    ],
  },
  {
    role: 'Data Engineer',
    company: 'FPT Software',
    period: 'Jul 2024 — Jun 2025',
    location: 'Vietnam',
    highlights: [
      'Azure Event Hub retail pipeline ~400K records/hour.',
      '~70% faster reports, ~40% lower cloud cost; ADF, ADLS, Monitor, Power BI.',
    ],
  },
  {
    role: 'Data Engineer',
    company: 'FPT Software',
    period: 'Jul 2023 — Jul 2024',
    location: 'Vietnam',
    highlights: [
      'AWS data lake for 12 regions and 1,000+ stores.',
      'Glue + Lambda pipelines orchestrated by Step Functions; CloudFormation / Terraform.',
    ],
  },
  {
    role: 'Software Engineer (freelance)',
    company: 'Yanolja',
    period: 'Feb 2024 — May 2024',
    location: 'Korea',
    highlights: [
      'Monitoring dashboards, backend logging, Dockerfiles, GitHub CI/CD.',
    ],
  },
];

export const extras = [
  { label: 'Education', value: 'B.Sc. Computer Science, UET — VNU (2021–2025, GPA 3.42)' },
  { label: 'Cert', value: 'Azure Data Engineer Associate' },
  { label: 'Research', value: 'KSE 2023 paper · ALQAC 2023 1st prize, legal retrieval' },
  { label: 'Also ships', value: 'React + FastAPI air-quality app (LSTM / PatchTST, Airflow)' },
];
