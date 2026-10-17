import { profile } from '../data/profile';

export function Hero() {
  return (
    <header className="hero">
      <h1>{profile.name}</h1>
      <p className="title">{profile.title}</p>
      <p>{profile.summary}</p>
      <p>{profile.location}</p>
      <p>{profile.availability}</p>
      <p className="links">
        <a href={`mailto:${profile.email}`}>Email</a>
        <a href={profile.github}>GitHub</a>
        <a href={profile.linkedin}>LinkedIn</a>
        <a href="#report">Try the report</a>
      </p>
    </header>
  );
}
