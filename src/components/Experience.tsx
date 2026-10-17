import { experiences } from '../data/profile';
import { alsoShipped } from '../data/platform';

export function Experience() {
  return (
    <section className="experience" aria-labelledby="experience-heading">
      <h2 id="experience-heading">Also shipped</h2>
      {alsoShipped.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <h2>Experience</h2>
      {experiences.map((job) => (
        <article key={`${job.company}-${job.period}`}>
          <h3>{job.role}</h3>
          <p>{job.company}</p>
          <p>{`${job.period} · ${job.location}`}</p>
          <ul>
            {job.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
