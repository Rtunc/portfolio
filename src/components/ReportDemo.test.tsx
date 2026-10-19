import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoErrorBoundary } from './DemoErrorBoundary';
import { ReportDemo } from './ReportDemo';
import type { SqlExecutor } from '../demo/engine';
import { preset } from '../demo/state';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function executor(query: SqlExecutor['query']): SqlExecutor {
  return {
    exec: vi.fn(async () => undefined),
    registerCsv: vi.fn(async () => undefined),
    // loadFeeLines probes column types through query. Answer that here so the mock counts report SQL only.
    query: async (sql, params) => {
      if (sql.includes('typeof(fee_month)')) return [{ month_type: 'DATE', amount_type: 'DOUBLE' }];
      return query(sql, params);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'learner_id,learner,site,room,programme,fee_type,status,fee_month,amount\n' })));
});

describe('ReportDemo', () => {
  it('shows the loading status, then the preset chart', async () => {
    const gate = deferred<SqlExecutor>();
    const query = vi.fn(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 900 }]);
    render(<ReportDemo connect={() => gate.promise} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the demo data.');
    expect(query).not.toHaveBeenCalled();
    gate.resolve(executor(query));
    const chart = await screen.findByTestId('chart');
    expect(within(chart).getByText('Harbor')).toBeInTheDocument();
    expect(screen.getByText('Synthetic. Not a client.')).toBeInTheDocument();
    expect(screen.getByText('Where this number comes from')).toBeInTheDocument();
  });

  it('marks each field with its data type and keeps the checkbox name', () => {
    render(<ReportDemo connect={async () => executor(async () => [])} />);
    const site = screen.getByRole('checkbox', { name: 'Site' });
    const month = screen.getByRole('checkbox', { name: 'Month' });
    const amount = screen.getByRole('checkbox', { name: 'Amount' });
    expect(site.querySelector('svg')).toHaveAttribute('data-type', 'dimension');
    expect(site.querySelector('text')).toHaveAttribute('fill', '#6d6d6d');
    expect(month.querySelector('svg')).toHaveAttribute('data-type', 'time');
    expect(month.querySelector('rect')).toHaveAttribute('stroke', '#C19C00');
    expect(amount.querySelector('svg')).toHaveAttribute('data-type', 'measure');
    expect(amount.querySelector('path')).toHaveAttribute('stroke', '#118DFF');
    expect(screen.getByRole('button', { name: 'Fee lines' }).querySelector('svg')).toHaveAttribute('data-type', 'table');
  });

  it('filters with an operator that matches the field type', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    const query = vi.fn(async (sql: string) => {
      seen.push(sql);
      return [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }];
    });
    render(<ReportDemo connect={async () => executor(query)} />);
    await screen.findByTestId('chart');
    expect(screen.queryByRole('group', { name: 'Sites' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Start month')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End month')).not.toBeInTheDocument();
    const operator = screen.getByRole('combobox', { name: 'Operator 1' });
    expect(within(operator).getByRole('option', { name: /^Between$/ })).toBeInTheDocument();
    expect(within(operator).queryByRole('option', { name: /^Contains$/ })).not.toBeInTheDocument();
    expect(within(operator).queryByRole('option', { name: /^Greater than$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Field 1' }).closest('li')?.querySelector('svg')).toHaveAttribute('data-type', 'time');
    expect(screen.getByLabelText('From 1')).toHaveValue('2024-01');
    expect(screen.getByLabelText('To 1')).toHaveValue('2025-06');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Field 2' }), 'site');
    const second = screen.getByRole('combobox', { name: 'Operator 2' });
    expect(within(second).getByRole('option', { name: /^Contains$/ })).toBeInTheDocument();
    expect(within(second).queryByRole('option', { name: /^Greater than$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Field 2' }).closest('li')?.querySelector('svg')).toHaveAttribute('data-type', 'dimension');
    await user.selectOptions(second, 'contains');
    await user.type(screen.getByRole('textbox', { name: 'Value 2' }), 'Harbor');
    await waitFor(() => expect(seen.join('\n')).toContain('contains(site, ?)'));
    await user.click(screen.getByRole('button', { name: 'Remove filter 2' }));
    await user.click(screen.getByRole('button', { name: 'Remove filter 1' }));
    expect(screen.getByText("No filters yet — add one to narrow this widget's data.")).toBeInTheDocument();
  });

  it('pins a sample of the fee table and hides SQL when that sample fails', async () => {
    const user = userEvent.setup();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('LIMIT 100')) {
        return [{ fee_month: '2024-01-01', site: 'Harbor', room: 'A', programme: 'Care', fee_type: 'Standard', status: 'Open', learner: 'L1' }];
      }
      return [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }];
    });
    render(<ReportDemo connect={async () => executor(query)} />);
    await screen.findByTestId('chart');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = await screen.findByRole('dialog', { name: 'Fee lines' });
    expect(within(dialog).getByText('Harbor')).toBeInTheDocument();
    expect(within(dialog).getByText('time')).toBeInTheDocument();
    expect(within(dialog).getByText('1 sample rows')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Preview' }));
    fireEvent.mouseLeave(dialog);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByRole('dialog', { name: 'Fee lines' })).toBeInTheDocument();
    const calls = query.mock.calls.length;
    await user.click(screen.getByRole('checkbox', { name: 'Room' }));
    await waitFor(() => expect(query.mock.calls.length).toBeGreaterThan(calls));
    expect(screen.getByRole('dialog', { name: 'Fee lines' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.queryByRole('dialog', { name: 'Fee lines' })).not.toBeInTheDocument();

    query.mockImplementation(async (sql: string) => {
      if (sql.includes('LIMIT 100')) throw new Error('SELECT secret FROM fee_lines');
      return [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }];
    });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This preview couldn't load.");
    expect(alert.textContent ?? '').not.toContain('SELECT');
  });

  it('shows X guidance and does not query when the chart has no dimension', async () => {
    const query = vi.fn(async () => []);
    render(<ReportDemo connect={async () => executor(query)} initialState={{ ...preset(), chartX: null, chartSeries: null, chartY: ['amount'], extras: [] }} />);
    expect(await screen.findByRole('status')).toHaveTextContent('Add a field to X.');
    expect(query).not.toHaveBeenCalled();
  });

  it('retries a failed load without showing invented numbers', async () => {
    const user = userEvent.setup();
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('wasm down'))
      .mockResolvedValueOnce(executor(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 900 }]));
    render(<ReportDemo connect={connect} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This demo couldn't load.");
    expect(alert).not.toHaveTextContent('900');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('hides SQL from a query failure and retries the same view', async () => {
    const user = userEvent.setup();
    const query = vi.fn()
      .mockRejectedValueOnce(new Error('SELECT secret FROM fee_lines'))
      .mockResolvedValueOnce([{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }]);
    render(<ReportDemo connect={async () => executor(query)} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This view couldn't be calculated.");
    expect(alert.textContent ?? '').not.toContain('SELECT secret');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('shows field buttons on a desktop and hides them behind Fields when narrow', async () => {
    const user = userEvent.setup();
    const query = vi.fn(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }]);
    window.matchMedia = (media: string) => ({
      matches: media === '(max-width: 800px)',
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
    render(<ReportDemo connect={async () => executor(query)} />);
    await screen.findByTestId('chart');
    const calls = query.mock.calls.length;
    expect(screen.queryByRole('checkbox', { name: 'Site' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('checkbox', { name: 'Site' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Data' }));
    expect(query.mock.calls.length).toBe(calls);
  });

  it('does not move a measure dropped on Rows', async () => {
    const user = userEvent.setup();
    window.matchMedia = (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
    const query = vi.fn(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }]);
    render(<ReportDemo connect={async () => executor(query)} />);
    await screen.findByTestId('chart');
    expect(screen.getByRole('checkbox', { name: 'Site' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pivot Table' }));
    const amount = await screen.findByRole('checkbox', { name: 'Amount' });
    const rows = screen.getByRole('list', { name: 'Rows' });
    fireEvent.dragStart(amount, { dataTransfer: { setData: vi.fn(), getData: () => 'amount' } });
    fireEvent.dragOver(rows);
    fireEvent.drop(rows, { dataTransfer: { getData: () => 'amount' } });
    expect(rows).not.toHaveTextContent('Amount');
  });

  it('asks for X after the last field is removed', async () => {
    const user = userEvent.setup();
    window.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
    render(<ReportDemo connect={async () => executor(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }])} />);
    await screen.findByTestId('chart');
    await user.click(screen.getByRole('button', { name: 'Remove Month' }));
    await user.click(screen.getByRole('button', { name: 'Remove Site' }));
    await user.click(screen.getByRole('button', { name: 'Remove Amount' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Add a field to X.');
  });

  it('shows Fields when the viewport becomes narrow', async () => {
    let matches = false;
    let listener: (() => void) | null = null;
    window.matchMedia = () => ({
      get matches() {
        return matches;
      },
      media: '(max-width: 800px)',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (_type: string, next: EventListenerOrEventListenerObject) => {
        if (typeof next === 'function') listener = () => next(new Event('change'));
      },
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
    render(<ReportDemo connect={async () => executor(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }])} />);
    await screen.findByTestId('chart');
    expect(screen.queryByRole('button', { name: 'Data' })).not.toBeInTheDocument();
    matches = true;
    act(() => listener?.());
    expect(screen.getByRole('button', { name: 'Data' })).toBeInTheDocument();
  });

  it('replaces a failed query with guidance after the last field is removed', async () => {
    const user = userEvent.setup();
    window.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
    const query = vi.fn().mockRejectedValue(new Error('SELECT secret FROM fee_lines'));
    render(<ReportDemo connect={async () => executor(query)} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("This view couldn't be calculated.");
    await user.click(screen.getByRole('button', { name: 'Remove Month' }));
    await user.click(screen.getByRole('button', { name: 'Remove Site' }));
    await user.click(screen.getByRole('button', { name: 'Remove Amount' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Add a field to X.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('widget canvas', () => {
  it('adds a widget, accepts a dropped chart, and drags the card on the grid', async () => {
    const user = userEvent.setup();
    const query = vi.fn(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }]);
    render(<ReportDemo connect={async () => executor(query)} />);
    await screen.findByTestId('chart');
    await user.click(screen.getByRole('button', { name: 'Add Widget' }));
    await user.click(screen.getByRole('menuitem', { name: 'Data Table' }));
    expect(screen.getByRole('heading', { name: 'Untitled table' })).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fees by site and month' }).closest('article')).toHaveAttribute('data-grid-w', '12');

    const transfer = {
      setData: vi.fn(),
      getData: (type: string) => (type === 'application/x-crv2-chart' ? 'line' : ''),
    };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Line' }), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId('report-canvas'), { dataTransfer: transfer });
    expect(screen.getByRole('heading', { name: 'Untitled chart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Line' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Fees by site and month' }).closest('article')).toHaveAttribute('data-grid-w', '6');
    await waitFor(() => expect(screen.getAllByTestId('chart')).toHaveLength(2));

    const handle = screen.getAllByRole('button', { name: 'Drag to move widget' })[0];
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 0, clientY: 200 });
    fireEvent.pointerUp(window);
    expect(handle.closest('article')).toHaveAttribute('data-grid-y', '2');

    await user.click(screen.getByRole('button', { name: 'Add Widget' }));
    await user.click(screen.getByRole('menuitem', { name: 'Number card' }));
    expect(screen.getByText('Number card is not in this demo.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions for Fees by site and month' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByRole('heading', { name: 'Fees by site and month' })).not.toBeInTheDocument();
  });
});

describe('DemoErrorBoundary', () => {
  it('switches chart marks and aggregation from the field menu', async () => {
    const user = userEvent.setup();
    const query = vi.fn(async () => [{ fee_month: '2024-01-01', site: 'Harbor', m_amount_sum: 1 }]);
    render(<ReportDemo connect={async () => executor(query)} />);
    await screen.findByTestId('chart');
    await user.click(screen.getByRole('button', { name: 'Stacked column' }));
    expect(screen.getByRole('button', { name: 'Stacked column' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Clustered column' })).toHaveAttribute('aria-pressed', 'false');
    const amount = screen.getByText('Sum of Amount').closest('li');
    if (!amount) throw new Error('missing amount chip');
    await user.click(within(amount).getByRole('button', { name: 'Field options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Average' }));
    expect(screen.getByText('Average of Amount')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pie' }));
    expect(screen.getByRole('button', { name: 'Pie' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Scatter' }));
    expect(screen.getByText('Scatter is not in this demo.')).toBeInTheDocument();
  });

  it('hides a render error that contains SQL', () => {
    function Boom(): null {
      throw new Error('SELECT secret');
    }
    render(
      <DemoErrorBoundary>
        <Boom />
      </DemoErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("This demo couldn't load.");
    expect(alert.textContent ?? '').not.toContain('SELECT secret');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
