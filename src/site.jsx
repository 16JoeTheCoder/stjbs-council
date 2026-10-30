// The public website at /. No sign-in and no Firebase SDK: it reads the one public/feed document over REST,
// once per visit, and falls back to the last copy it saw. Only the Live and Coming up sections depend on it.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '../design/fiatlux/tokens.css';
import '../design/fiatlux/components.css';
import './app.css';
import building from '../design/fiatlux/img/building.webp';
import crest from '../design/fiatlux/img/crest-256.png';
import { Announcements, Icon, Mission, PublicProject } from './shared.jsx';
import { ago, feedToday } from './feed.js';
import { fmtDay } from './time.js';

const env = import.meta.env;
const FEED_URL = env.VITE_EMULATORS === '1'
  ? 'http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents/public/feed'
  : `https://firestore.googleapis.com/v1/projects/${env.VITE_FB_PROJECT_ID}/databases/(default)/documents/public/feed?key=${env.VITE_FB_API_KEY}`;
const KEY = 'council-feed';

// REST encodes numbers as strings, so read whichever value type came back.
const num = (f) => Number(f?.integerValue ?? f?.doubleValue ?? (f?.timestampValue ? Date.parse(f.timestampValue) : 0));

const FRESH_MS = 5 * 60e3;
const cached = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c?.v ? c : null; } catch { return null; } };

// A visitor who reloads within 5 minutes reuses their copy: the free read quota is shared with the dashboard.
async function loadFeed() {
  const copy = cached();
  if (copy && Date.now() - copy.fetchedAt < FRESH_MS) return { feed: copy };
  try {
    const r = await fetch(FEED_URL);
    if (!r.ok) throw new Error(String(r.status));
    const { fields } = await r.json();
    const feed = { ...JSON.parse(fields.json.stringValue), updatedAt: num(fields.updatedAt), fetchedAt: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(feed)); } catch {}
    return { feed };
  } catch {
    return copy ? { feed: copy, stale: true } : {};
  }
}

const EVENT_TAG = { meeting: 'fl-tag--meeting', committee: 'fl-tag--committee' };

function Site() {
  const [state, setState] = useState(null);
  useEffect(() => { loadFeed().then(setState); }, []);
  const live = state?.feed && feedToday(state.feed);
  return (
    <>
      <a class="fl-skip" href="#main">Skip to content</a>
      <header class="fl-site-top">
        <a class="fl-brand" href="#main"><img src={crest} alt="" width="44" height="44" /><div><b>Student Council</b><span>St. Johannes Berchmans</span></div></a>
        <nav class="fl-site-nav" aria-label="Sections">
          <a href="#main">Home</a><a href="#events">Events</a><a href="#live">Projects</a><a href="#about">About</a>
        </nav>
        <a class="fl-btn fl-btn--red fl-btn--sm" href="/app/">Dashboard</a>
      </header>
      <main id="main" class="fl-main fl-site">
        <section class="fl-hero fl-hero--tall fl-stage" aria-labelledby="hero-h">
          <img class="fl-hero__img" src={building} alt="" width="1600" height="898" fetchpriority="high" />
          <div class="fl-hero__body">
            <span class="fl-eyebrow">St. Johannes Berchmans Student Council</span>
            <h1 id="hero-h" class="fl-display">Lead. <span class="fl-light">Serve. Build.</span></h1>
            <p class="fl-muted">Students who plan the events, projects and changes that make school better for everyone.</p>
            <div class="fl-actions"><a class="fl-btn fl-btn--red" href="#live">Explore our work</a><a class="fl-btn fl-btn--ghost" href="#join">Join us</a></div>
          </div>
        </section>

        {live && <Announcements list={live.announcements} />}

        <section id="live" class="fl-panel" aria-labelledby="live-h">
          <div class="fl-panel__head">
            <h2 id="live-h" class="fl-h2">What we are working on now</h2>
            {state?.feed && <span class="fl-live">{state.stale ? 'Updated earlier' : `Last change ${ago(state.feed.updatedAt)}`}</span>}
          </div>
          {!state ? <p class="fl-muted" role="status">Loading the latest projects.</p>
            : !live ? <p class="fl-muted">Our current projects appear here. Check back soon.</p>
            : live.projects.length ? <div class="fl-grid">{live.projects.map((p) => <PublicProject key={p.title} p={p} />)}</div>
            : <p class="fl-muted">No public projects right now. Check back soon.</p>}
        </section>

        <section id="events" class="fl-panel" aria-labelledby="events-h">
          <div class="fl-panel__head"><h2 id="events-h" class="fl-h2">Coming up</h2></div>
          {live?.events.length ? (
            <ul class="fl-list">{live.events.slice(0, 8).map((e) => (
              <li key={e.date + e.start + e.title} class="fl-up">
                <span class="fl-date">{fmtDay(e.date).split(' ')[2]}<b>{e.date.slice(8)}</b></span>
                <div><h3 class="fl-h3">{e.title}</h3><p class="fl-small fl-muted"><span class="fl-mono">{fmtDay(e.date)} · {e.start} to {e.end}</span>{e.location && ` · ${e.location}`}</p></div>
                <span class={`fl-tag ${EVENT_TAG[e.type] || ''}`}>{e.type[0].toUpperCase() + e.type.slice(1)}</span>
              </li>))}</ul>
          ) : <p class="fl-muted">{state ? 'No public events are scheduled yet.' : 'Loading events.'}</p>}
        </section>

        <Mission img={building} />

        <section id="about" class="fl-panel" aria-labelledby="about-h">
          <h2 id="about-h" class="fl-h2">About the council</h2>
          <p class="fl-muted fl-measure">The student council of St. Johannes Berchmans School plans school events, runs projects with partners and sponsors, and carries student ideas to the school. Officers from every section meet each week and report what they did.</p>
        </section>
      </main>
      <footer class="fl-site-foot">
        <section id="join" aria-labelledby="join-h">
          <h2 id="join-h" class="fl-h3">How to join</h2>
          <p class="fl-small fl-muted">Talk to any officer of your section. They will tell you about the next intake and how to help on a project before then.</p>
        </section>
        <p class="fl-small fl-muted"><img src={crest} alt="" width="32" height="32" /> St. Johannes Berchmans Student Council · <a class="fl-link" href="/app/">Members' dashboard <Icon n="arrow" /></a></p>
      </footer>
    </>
  );
}

render(<Site />, document.getElementById('site'));
