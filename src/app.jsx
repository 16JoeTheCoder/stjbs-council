// The shell: left rail on laptop, floating tab bar on phone, search, bell and avatar menu in the top bar,
// and a member or admin view. Routes are hash routes under /app/.
import { useEffect, useRef, useState } from 'preact/hooks';
import { S, loaded, set, signOutHere, unreadCount, useStore } from './store.js';
import { isAdmin, isExec, roleName } from './model.js';
import { markRead } from './actions.js';
import { startAdminJobs } from './publish.js';
import { stamp } from './time.js';
import { Icon, Sheet } from './shared.jsx';
import { Chip, Title } from './ui.jsx';
import { Search } from './search.jsx';
import { Login, Verify } from './routes/auth.jsx';
import { AllTasks, Home } from './routes/home.jsx';
import { Item, Projects } from './routes/projects.jsx';
import { Checkin, Meeting } from './routes/meeting.jsx';
import { People } from './routes/people.jsx';
import { Feed } from './routes/feed.jsx';
import { Digest } from './routes/digest.jsx';
import { Templates } from './routes/templates.jsx';
import { Workload } from './routes/workload.jsx';
import { Admin } from './routes/admin.jsx';
import { Announcements, Approvals, Overview, PublicSite } from './routes/admin-views.jsx';
import { Settings } from './routes/settings.jsx';
import { Ideas } from './routes/ideas.jsx';
import { Calendar } from './routes/calendar.jsx';
import { Resources } from './routes/resources.jsx';
import crest from '../design/fiatlux/img/crest-256.png';
import building from '../design/fiatlux/img/building.webp';

const parse = () => {
  const [path, qs] = location.hash.slice(1).split('?');
  const [name = 'week', id = null] = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name, id, q: new URLSearchParams(qs) };
};

const Missing = () => <><Title light="Not here." bold="Page not found" /><p><a class="fl-link" href="#/week">Go to Home</a></p></>;
const NotForYou = () => <><Title light="Not for you." bold="Admin" /><p>Only the advisor, the president and the vice president open the admin view.</p></>;
const ADMIN_PAGES = { overview: Overview, announcements: Announcements, members: Admin, workload: Workload, public: PublicSite, approvals: Approvals, digest: Digest };
const AdminRoute = ({ id }) => {
  if (!isAdmin()) return <NotForYou />;
  const Page = ADMIN_PAGES[id || 'overview'] || Missing;
  return <Page nav={ADMIN_NAV} />;
};
const ROUTES = {
  week: Home, tasks: AllTasks, checkin: Checkin, projects: Projects, p: Item, meeting: Meeting, people: People, committees: People,
  ideas: Ideas, calendar: Calendar, resources: Resources, activity: Feed, feed: Feed, digest: Digest, templates: Templates, workload: Workload, settings: Settings, about: Settings, admin: AdminRoute,
};

const MEMBER_NAV = [['week', 'Home', 'home'], ['calendar', 'Calendar', 'calendar'], ['projects', 'Projects', 'projects'], ['committees', 'Committees', 'committees'], ['resources', 'Resources', 'resources']];
export const ADMIN_NAV = [['admin', 'Overview', 'shield'], ['admin/announcements', 'Announcements', 'megaphone'], ['admin/members', 'Members and roles', 'committees'],
  ['admin/workload', 'Check-ins and workload', 'chart'], ['admin/public', 'Public site', 'globe'], ['admin/approvals', 'Approvals and archive', 'inbox'], ['admin/digest', 'Digest', 'digest']];
const TABS = [['week', 'Home', 'home'], ['calendar', 'Calendar', 'calendar'], ['projects', 'Projects', 'projects'], ['ideas', 'Ideas', 'ideas']];
// Which nav entry a route lights up.
const ALIAS = { tasks: 'week', checkin: 'week', p: 'projects', meeting: 'projects', people: 'committees', feed: 'activity', about: 'settings' };
const navKey = (r) => (r.name === 'admin' ? `admin${r.id ? `/${r.id}` : ''}` : ALIAS[r.name] || r.name);

// A popover that closes on an outside tap, on Esc (focus back to its button) and on navigation.
function usePop(route) {
  const [open, setOpen] = useState(false), ref = useRef();
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); } };
    addEventListener('pointerdown', out); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', out); removeEventListener('keydown', esc); };
  }, [open]);
  return [open, setOpen, ref];
}

function Bell({ route }) {
  const [open, setOpen, ref] = usePop(route);
  const n = unreadCount(), label = n >= 50 ? '50+' : String(n);
  return (
    <div class="fl-search-host" ref={ref}>
      <button class="fl-iconbtn" aria-label={`Notifications, ${label} unread`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon n="bell" />{n > 0 && <span class="fl-count-text" aria-hidden="true">{label}</span>}
      </button>
      {open && (
        <div class="fl-pop fl-pop--wide" role="region" aria-label="Notifications">
          <h4>For you</h4>
          {S.notes.length ? S.notes.slice(0, 6).map((x) => (
            <a key={x.id} class={`fl-note-item${x.read ? '' : ' is-unread'}`} href={x.itemId ? `#/p/${x.itemId}` : '#/activity'} onClick={() => !x.read && markRead(x)}>
              <Chip email={x.fromUid} /><span>{S.members.find((m) => m.id === x.fromUid)?.name.split(' ')[0] || 'Someone'} {x.text} <small>{stamp(x.createdAt)}</small></span>
            </a>
          )) : <p class="fl-small fl-muted fl-pad">Nothing yet. Comments, mentions and tasks for you show up here.</p>}
          <hr />
          {n > 0 && <button onClick={() => S.notes.filter((x) => !x.read).forEach(markRead)}><Icon n="check" />Mark all as read</button>}
          <a href="#/activity"><Icon n="activity" />See all activity</a>
        </div>
      )}
    </div>
  );
}

function UserMenu({ route, adminView, switchView }) {
  const [open, setOpen, ref] = usePop(route);
  return (
    <div class="fl-search-host" ref={ref}>
      <button class="fl-user" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Chip email={S.me.id} big /><span><b>{S.me.name}</b><small>{roleName(S.me.role)}</small></span>
      </button>
      {open && (
        <div class="fl-pop" role="menu">
          <a role="menuitem" href={`#/people/${encodeURIComponent(S.me.id)}`}><Icon n="user" />My profile</a>
          <a role="menuitem" href="#/settings"><Icon n="settings" />Settings</a>
          {isAdmin() && <button role="menuitem" onClick={() => switchView(adminView ? 'member' : 'admin')}><Icon n="shield" />{adminView ? 'Switch to member view' : 'Switch to admin view'}</button>}
          <hr />
          <button role="menuitem" onClick={signOutHere}><Icon n="out" />Sign out</button>
        </div>
      )}
    </div>
  );
}

// Everything the tab bar does not cover, so no destination exists only on laptop.
function More({ close, adminView, switchView }) {
  const link = (href, label, icon) => <a href={href} onClick={close}><Icon n={icon} />{label}</a>;
  return (
    <Sheet label="More" onClose={close}>
      <nav class="fl-more" aria-label="More">
        <h2 class="fl-eyebrow">Council</h2>
        {link('#/committees', 'Committees', 'committees')}
        {link('#/resources', 'Resources', 'resources')}
        {link('#/activity', 'All activity', 'activity')}
        {isExec() && !isAdmin() && link('#/digest', 'Digest', 'digest')}
        {isExec() && link('#/templates', 'Project templates', 'copy')}
        {isAdmin() && <>
          <h2 class="fl-eyebrow">Admin</h2>
          {ADMIN_NAV.map(([k, label, icon]) => link(`#/${k}`, label, icon))}
          <button onClick={() => { close(); switchView(adminView ? 'member' : 'admin'); }}><Icon n="shield" />{adminView ? 'Switch to member view' : 'Switch to admin view'}</button>
        </>}
        {link('#/settings', 'Settings', 'settings')}
      </nav>
    </Sheet>
  );
}

const readView = () => { try { return localStorage.getItem('council-view') || 'member'; } catch { return 'member'; } };

export function App() {
  useStore();
  const [route, setRoute] = useState(parse), [view, setView] = useState(readView), [more, setMore] = useState(false);
  useEffect(() => { const f = () => setRoute(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const admin = S.phase === 'ready' && isAdmin();
  useEffect(() => (admin ? startAdminJobs() : undefined), [admin]);
  if (S.phase === 'signed-out' || S.phase === 'no-roster') return <Login />;
  if (S.phase === 'verify') return <Verify />;
  if (S.phase !== 'ready' || S.term === null || (S.term && !loaded())) return <main id="main" class="fl-loading"><p class="fl-muted" role="status">Loading the council.</p></main>;
  if (S.term === false) return <main id="main" class="fl-loading"><p role="alert">No term is set. Ask the advisor to create settings/current.</p></main>;

  const adminView = isAdmin() && (route.name === 'admin' || view === 'admin');
  const switchView = (v) => { try { localStorage.setItem('council-view', v); } catch {} setView(v); location.hash = v === 'admin' ? '#/admin' : '#/week'; };
  const key = navKey(route), Page = ROUTES[route.name] || Missing;
  const navLink = ([k, label, icon]) => <a key={k} href={`#/${k}`} aria-current={key === k ? 'page' : undefined}><Icon n={icon} />{label}</a>;
  return (
    <div class="fl-app">
      <a class="fl-skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main').focus(); }}>Skip to content</a>
      <aside class="fl-rail">
        <a class="fl-brand" href="#/week"><img src={crest} alt="" width="44" height="44" /><div><b>Student Council</b><span>St. Johannes Berchmans</span></div></a>
        {adminView && <span class="fl-badge-admin">Admin view</span>}
        <nav class="fl-nav" aria-label="Main">{(adminView ? ADMIN_NAV : MEMBER_NAV).map(navLink)}</nav>
        <a class="fl-rail__photo" href="/"><img src={building} alt="" /><span>Together for a stronger community</span></a>
      </aside>
      <div class="fl-col">
        <header class="fl-top">
          <img class="fl-top__crest" src={crest} alt="Student Council" width="40" height="40" />
          <Search />
          <div class="fl-tools"><Bell route={route} /><UserMenu route={route} adminView={adminView} switchView={switchView} /></div>
        </header>
        {S.error && <p class="fl-alert" role="alert">{S.error}</p>}
        <main id="main" tabIndex={-1} class="fl-main"><Page key={`${route.name}/${route.id}`} id={route.id} q={route.q} /></main>
      </div>
      <nav class="fl-tabbar" aria-label="Tabs">
        {TABS.map(([k, label, icon]) => <a key={k} href={`#/${k}`} aria-label={label} aria-current={key === k ? 'page' : undefined}><Icon n={icon} /></a>)}
        <button aria-label="More" aria-expanded={more} onClick={() => setMore(true)}><Icon n="more" /></button>
      </nav>
      {more && <More close={() => setMore(false)} adminView={adminView} switchView={switchView} />}
      <div class={S.toast ? 'fl-toast' : 'fl-sr'} role="status" aria-live="polite">{S.toast}{S.undo && <>
        <button class="fl-btn fl-btn--sm fl-btn--ghost" onClick={() => { S.undo.fn(); set({ undo: null, toast: '' }); }}>{S.undo.label}</button>
        <button class="fl-btn fl-btn--sm fl-btn--ghost" onClick={() => set({ undo: null, toast: '' })}>Dismiss</button></>}</div>
    </div>
  );
}
