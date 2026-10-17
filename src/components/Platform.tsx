import { claims, steps } from '../data/platform';

export function Platform() {
  return (
    <section className="platform" aria-labelledby="platform-heading">
      <h2 id="platform-heading">The platform</h2>
      <ol aria-label="Platform path">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {claims.map((claim) => (
        <article key={claim.title}>
          <h3>{claim.title}</h3>
          <p>{claim.body}</p>
        </article>
      ))}
    </section>
  );
}
