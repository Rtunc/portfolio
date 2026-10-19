import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

describe('App', () => {
  it('renders the claim, the platform path, and the experience without the old can-do list', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nguyen Thach Anh');
    expect(screen.getByText('Data platform engineer')).toBeInTheDocument();
    expect(screen.getByText(/I own the Glue lakehouse platform/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try the report' })).toHaveAttribute('href', '#report');
    const path = screen.getByRole('list', { name: 'Platform path' });
    expect(path).toHaveTextContent('Postgres');
    expect(path).toHaveTextContent('CDC');
    expect(path).toHaveTextContent('Raw');
    expect(path).toHaveTextContent('Glue');
    expect(path).toHaveTextContent('DWH');
    expect(path).toHaveTextContent('Curated schema');
    expect(screen.getByRole('img', { name: /Postgres to CDC to Raw to Glue/ })).toBeInTheDocument();
    expect(screen.getByText(/Publications, slots, and LSN stay consistent/)).toBeInTheDocument();
    expect(screen.getAllByText(/Postgres CDC into Iceberg/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Staff reports read the lake/)).toBeInTheDocument();
    expect(screen.getByText('LittleLives')).toBeInTheDocument();
    expect(screen.queryByText('Postgres CDC → Iceberg')).not.toBeInTheDocument();
    const platform = screen.getByRole('list', { name: 'Platform path' }).closest('section');
    expect(platform?.textContent ?? '').not.toMatch(/newlife|ilham|organisation_id|cron/i);
  });
});
