import { claims, pathLine } from '../data/platform';
import { LineagePath } from './LineagePath';

export function Platform() {
  return (
    <section className="platform" aria-labelledby="platform-heading">
      <h2 id="platform-heading">The data path</h2>
      <p className="path-lead">{pathLine}</p>
      <LineagePath mode="page" />
      <h3>What I own on that path</h3>
      {claims.map((claim) => (
        <article key={claim.title}>
          <h3>{claim.title}</h3>
          <p>{claim.body}</p>
        </article>
      ))}
    </section>
  );
}
