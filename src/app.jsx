import { useEffect, useState } from 'preact/hooks';
import { S, loaded, set, useStore } from './store.js';
import { canSeeStats, isBoss } from './model.js';
import { Chip, Icon, Title } from './ui.jsx';
import { Login, Verify } from './routes/auth.jsx';
import { MyWeek } from './routes/my-week.jsx';
import { Item, Projects } from './routes/projects.jsx';
import { Checkin, Meeting } from './routes/meeting.jsx';
import { People } from './routes/people.jsx';
import { Feed } from './routes/feed.jsx';
import { Digest } from './routes/digest.jsx';
import { Templates } from './routes/templates.jsx';
import { Workload } from './routes/workload.jsx';
import { Admin } from './routes/admin.jsx';
import { About } from './routes/about.jsx';

const parse = () => {
  const [path, qs] = location.hash.slice(1).split('?');
  const [name = 'week', id = null] = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name, id, q: new URLSearchParams(qs) };
};

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('council-theme', theme); } catch {}
}

const Missing = () => <><Title light="Not here." bold="Page not found" /><p><a href="#/week">Go to My week</a></p></>;
const ROUTES = { week: MyWeek, projects: Projects, p: Item, checkin: Checkin, meeting: Meeting, people: People, feed: Feed, digest: Digest, templates: Templates, workload: Workload, admin: Admin, about: About };

export function App() {
  useStore();
  const [route, setRoute] = useState(parse);
  const [dark, setDark] = useState(document.documentElement.dataset.theme !== 'light');
  useEffect(() => { const f = () => setRoute(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  if (S.phase === 'signed-out' || S.phase === 'no-roster') return <Login />;
  if (S.phase === 'verify') return <Verify />;
  if (S.phase !== 'ready' || S.term === null || (S.term && !loaded())) return <main id="main" class="jy-auth"><p class="jy-caption" role="status">Loading the council, step 1 of 1.</p></main>;
  if (S.term === false) return <main id="main" class="jy-auth"><p role="alert">No term is set. Ask the advisor to create settings/current.</p></main>;

  const unread = S.unread >= 100 ? '99+' : S.unread;
  const tabs = [['week', 'My week'], ['projects', 'Projects'], ['people', 'People'], ['feed', 'Feed']];
  const extra = [canSeeStats() && ['workload', 'Workload'], isBoss() && ['templates', 'Templates'],
    ['advisor', 'president'].includes(S.me.role) && ['admin', 'Admin']].filter(Boolean);
  const active = (k) => route.name === k || (k === 'projects' && ['p', 'meeting'].includes(route.name));
  const link = ([k, label], icon) => (
    <a key={k} href={`#/${k}`} aria-current={active(k) ? 'page' : undefined}>{icon && <Icon n={k} />}<span>{label}</span></a>
  );
  const Page = ROUTES[route.name] || Missing;
  const flip = () => { setTheme(dark ? 'light' : 'dark'); setDark(!dark); };
  return (
    <>
      <a class="jy-skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main').focus(); }}>Skip to content</a>
      <header class="jy-header">
        <a class="jy-brand" href="#/week">STJBS <b>Council</b></a>
        <nav class="jy-topnav" aria-label="Main">{[...tabs, ...extra].map((t) => link(t))}</nav>
        <div class="jy-tools">
          <a class="jy-iconbtn" href="#/feed" aria-label={`Notifications, ${unread} unread`}><Icon n="bell" /><span class="jy-mono" aria-hidden="true">{unread}</span></a>
          <button class="jy-iconbtn" onClick={flip} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}><Icon n={dark ? 'sun' : 'moon'} /></button>
          <a href={`#/people/${S.me.id}`} class="jy-me" aria-label="Your profile"><Chip email={S.me.id} big /></a>
        </div>
      </header>
      {S.error && <p class="jy-alert" role="alert">{S.error}</p>}
      <main id="main" tabIndex={-1} class="jy-page"><Page key={`${route.name}/${route.id}`} id={route.id} q={route.q} /></main>
      <nav class="jy-tabbar" aria-label="Tabs">{tabs.map((t) => link(t, true))}</nav>
      <div class="jy-toast" role="status" aria-live="polite">{S.toast}{S.undo && <button class="jy-link" onClick={() => { S.undo.fn(); set({ undo: null, toast: '' }); }}>{S.undo.label}</button>}</div>
    </>
  );
}
