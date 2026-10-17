import { lazy, Suspense } from 'react';
import { DemoErrorBoundary } from './components/DemoErrorBoundary';
import { Experience } from './components/Experience';
import { Hero } from './components/Hero';
import { Platform } from './components/Platform';

const ReportDemo = lazy(() => import('./components/ReportDemo').then((module) => ({ default: module.ReportDemo })));

export function App() {
  return (
    <main>
      <Hero />
      <Platform />
      <Suspense fallback={<section id="report" role="status">Loading the demo data.</section>}>
        <DemoErrorBoundary>
          <ReportDemo />
        </DemoErrorBoundary>
      </Suspense>
      <Experience />
    </main>
  );
}
