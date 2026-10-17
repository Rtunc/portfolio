import { Experience } from './components/Experience';
import { Hero } from './components/Hero';
import { Platform } from './components/Platform';

export function App() {
  return (
    <main>
      <Hero />
      <Platform />
      <section id="report" role="status">
        Loading the demo data.
      </section>
      <Experience />
    </main>
  );
}
