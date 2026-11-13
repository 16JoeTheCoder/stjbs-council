// Budgets: one row per event pot, the treasurer view (approvals, flagged, current batch), one budget's requests,
// the purchase request form and the request sheet (approve, veto, add receipt).
import { useEffect, useState } from 'preact/hooks';
import { S } from '../store.js';
import { fmtDay, idr, isoDay } from '../time.js';
import { PSTATUS, batchName, batches, budgetRows, flagged, fullName, price } from '../work-model.js';
import { addReceipt, cancelPurchase, decide, getPhoto, payBatch, photoSrc, requestPurchase, saveBudget, shrink, veto } from '../work-actions.js';
import { Sheet } from '../shared.jsx';
import { Quiet, Section } from './tasks.jsx';

const first = (uid) => fullName(S.members, uid).split(' ')[0];
const isTreasurer = () => S.me.role === 'treasurer';
const canBudget = () => isTreasurer() || ['advisor', 'president', 'vp'].includes(S.me.role);
const num = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;

function Photo({ id }) {
  const [data, setData] = useState(undefined);
  useEffect(() => { getPhoto(id).then(setData, () => setData(null)); }, [id]);
  if (data === undefined) return <p class="fl-quiet" role="status">Loading photo.</p>;
  return data ? <img class="fl-photo" src={photoSrc(data)} alt="" /> : <p class="fl-quiet">Photo removed (kept for two weeks after the batch is paid).</p>;
}
// Camera or gallery, the phone decides. Each photo is shrunk before it is kept.
function PhotoInput({ photos, set, max = 3, label }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const add = async (e) => {
    const files = [...e.target.files].slice(0, max - photos.length);
    e.target.value = '';
    setBusy(true); setErr('');
    try { set([...photos, ...await Promise.all(files.map(shrink))]); } catch { setErr('That photo could not be read. Try another one.'); }
    setBusy(false);
  };
  return (
    <div class="fl-photos">
      {photos.map((d, i) => <button type="button" key={i} class="fl-photos__one" aria-label="Remove photo" onClick={() => set(photos.filter((_, k) => k !== i))}><img src={photoSrc(d)} alt="" /></button>)}
      {photos.length < max && <label class="fl-btn fl-btn--ghost">{busy ? 'Adding photo…' : label}<input class="fl-sr" type="file" accept="image/*" multiple={max > 1} onChange={add} /></label>}
      {err && <p class="fl-error" role="alert">{err}</p>}
    </div>
  );
}

export const PurchaseRow = ({ p, who }) => {
  const [open, setOpen] = useState(false), amount = ['bought', 'paid'].includes(p.status) ? p.paidIdr : p.totalIdr;
  return (
    <>
      <button class={`fl-line${flagged(p) ? ' fl-line--flag' : ''}`} onClick={() => setOpen(true)}>
        <span><span class="fl-t__title">{p.item}</span><span class="fl-t__meta">{[who && first(p.requesterUid), flagged(p) ? `Flagged: asked ${idr(p.totalIdr)}` : PSTATUS[p.status]].filter(Boolean).join(' · ')}</span></span>
        <b class="fl-mono">{idr(amount)}</b>
      </button>
      {open && <PurchaseSheet p={S.purchases.find((x) => x.id === p.id) || p} close={() => setOpen(false)} />}
    </>
  );
};

function PurchaseSheet({ p, close }) {
  const [mode, setMode] = useState(null), [text, setText] = useState(''), [paid, setPaid] = useState(String(p.totalIdr)), [photo, setPhoto] = useState([]), [busy, setBusy] = useState(false);
  const mine = p.requesterUid === S.me.id, budget = S.budgets.find((b) => b.id === p.budgetId);
  const run = async (fn) => { setBusy(true); if (await fn()) close(); else setBusy(false); };
  const receipt = mine && p.status === 'approved';
  return (
    <Sheet label={p.item} onClose={close} low>
      <div class="fl-quick">
        <h2 class="fl-h2">{p.item}</h2>
        <p class="fl-money fl-mono">{idr(p.totalIdr)}</p>
        <p class="fl-small fl-muted">{p.qty} × {idr(p.unitIdr)} · {fullName(S.members, p.requesterUid)} · {budget?.name || 'Budget removed'} · {PSTATUS[p.status]}</p>
        {p.specs && <p class="fl-pre">{p.specs}</p>}
        {p.status === 'vetoed' && <p class="fl-late">Vetoed by {first(p.vetoUid)} on {fmtDay(isoDay(p.vetoAt))}: {p.vetoReason}</p>}
        {p.paidIdr != null && <p class={flagged(p) ? 'fl-late' : ''}>Paid {idr(p.paidIdr)}{p.paidIdr !== p.totalIdr && ` (${p.paidIdr > p.totalIdr ? '+' : '−'}${idr(Math.abs(p.paidIdr - p.totalIdr))})`}{p.changeNote && `: ${p.changeNote}`}</p>}
        {mode === null && <>
          {(p.photoIds || []).map((id) => <Photo key={id} id={id} />)}
          {p.receiptPhotoId && <Photo id={p.receiptPhotoId} />}
        </>}
        {mode === null && isTreasurer() && !mine && p.status === 'pending' && (
          <div class="fl-actions fl-actions--fill"><button class="fl-btn fl-btn--red" onClick={() => { decide(p, 'approved'); close(); }}>Approve</button><button class="fl-btn fl-btn--ghost" onClick={() => { decide(p, 'rejected'); close(); }}>Reject</button></div>
        )}
        {mode === null && isTreasurer() && mine && p.status === 'pending' && <Quiet>The other treasurer approves your own request.</Quiet>}
        {receipt && (
          <form class="fl-quick" onSubmit={(e) => { e.preventDefault(); if (photo.length && !busy) run(() => addReceipt(p, { paidIdr: num(paid), changeNote: text, photo: photo[0] })); }}>
            <PhotoInput photos={photo} set={setPhoto} max={1} label="Add receipt photo" />
            <label class="fl-field"><span class="fl-field__label">Amount paid (IDR)</span><input class="fl-input fl-mono" inputMode="numeric" value={paid} onInput={(e) => setPaid(e.target.value)} /></label>
            {num(paid) !== p.totalIdr && <input class="fl-input" maxLength={140} placeholder="What changed? (optional)" aria-label="What changed" value={text} onInput={(e) => setText(e.target.value)} />}
            <button class="fl-btn fl-btn--red fl-btn--block" disabled={!photo.length || busy}>{busy ? 'Saving…' : 'Save receipt'}</button>
          </form>
        )}
        {mode === 'veto' && (
          <form class="fl-quick" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy && confirm(`Veto "${p.item}"? The reason is kept on the record.`)) run(() => veto(p, text)); }}>
            <input class="fl-input" autoFocus maxLength={300} placeholder="Reason for the veto" aria-label="Reason for the veto" value={text} onInput={(e) => setText(e.target.value)} />
            <button class="fl-btn fl-btn--red fl-btn--block" disabled={!text.trim() || busy}>Veto request</button>
          </form>
        )}
        {mode === null && S.me.role === 'advisor' && p.status !== 'vetoed' && <button class="fl-linkbtn fl-quiet" onClick={() => setMode('veto')}>Veto this request</button>}
        {mine && p.status === 'pending' && <button class="fl-linkbtn fl-quiet" onClick={() => run(() => cancelPurchase(p))}>Delete request</button>}
      </div>
    </Sheet>
  );
}

// Item, photo, price. Type a unit price or a total; the other one is worked out as you type.
export function PurchaseForm({ close, budgetId }) {
  const pots = budgetRows(S.budgets, S.purchases);
  const [budget, setBudget] = useState(budgetId || pots[0]?.id || ''), [item, setItem] = useState(''), [photos, setPhotos] = useState([]);
  const [mode, setMode] = useState('unit'), [amount, setAmount] = useState(''), [qty, setQty] = useState('1'), [specs, setSpecs] = useState(null), [busy, setBusy] = useState(false);
  const p = price(mode, num(amount), num(qty)), ok = budget && item.trim() && photos.length && p.totalIdr > 0;
  const submit = async (e) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    if (await requestPurchase({ budgetId: budget, item, specs: specs || '', ...p }, photos)) close(); else setBusy(false);
  };
  if (!pots.length) return <Sheet label="Request a purchase" onClose={close} low><p class="fl-quiet">No budget exists yet. A treasurer adds one in Budgets.</p></Sheet>;
  return (
    <Sheet label="Request a purchase" onClose={close} low>
      <form class="fl-quick" onSubmit={submit}>
        {pots.length > 1 && !budgetId && <select class="fl-input" aria-label="Budget" value={budget} onChange={(e) => setBudget(e.target.value)}>{pots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <input class="fl-input" autoFocus maxLength={80} placeholder="What do you need to buy?" aria-label="Item" value={item} onInput={(e) => setItem(e.target.value)} />
        <PhotoInput photos={photos} set={setPhotos} label="Add photo" />
        <div class="fl-seg fl-seg--fill" role="group" aria-label="How you enter the price">
          <button type="button" aria-pressed={mode === 'unit'} onClick={() => setMode('unit')}>Price each</button><button type="button" aria-pressed={mode === 'total'} onClick={() => setMode('total')}>Total price</button>
        </div>
        <div class="fl-price">
          <label class="fl-field"><span class="fl-field__label">{mode === 'unit' ? 'Price each (IDR)' : 'Total (IDR)'}</span><input class="fl-input fl-mono" inputMode="numeric" value={amount} onInput={(e) => setAmount(e.target.value)} /></label>
          <label class="fl-field"><span class="fl-field__label">Quantity</span><input class="fl-input fl-mono" inputMode="numeric" value={qty} onInput={(e) => setQty(e.target.value)} /></label>
        </div>
        <p class="fl-small fl-muted" aria-live="polite">{mode === 'unit' ? `Total ${idr(p.totalIdr)}` : `${idr(p.unitIdr)} each`}</p>
        {specs === null ? <button type="button" class="fl-linkbtn fl-quiet" onClick={() => setSpecs('')}>Add specs (optional)</button>
          : <textarea class="fl-input" rows={2} maxLength={300} placeholder="Size, colour, shop, link" aria-label="Specs" value={specs} onInput={(e) => setSpecs(e.target.value)} />}
        <button class="fl-btn fl-btn--red fl-btn--block" disabled={!ok || busy}>{busy ? 'Sending…' : 'Send request'}</button>
      </form>
    </Sheet>
  );
}

function BudgetForm({ old, close }) {
  const [name, setName] = useState(old?.name || ''), [amount, setAmount] = useState(old ? String(old.amountIdr) : '');
  const save = (active) => (e) => { e.preventDefault(); if (!name.trim()) return; saveBudget(old, { name: name.trim().slice(0, 60), amountIdr: num(amount), active }); close(); };
  return (
    <Sheet label={old ? 'Edit budget' : 'New budget'} onClose={close} low>
      <form class="fl-quick" onSubmit={save(true)}>
        <input class="fl-input" autoFocus maxLength={60} placeholder="Event name" aria-label="Event name" value={name} onInput={(e) => setName(e.target.value)} />
        <label class="fl-field"><span class="fl-field__label">Budget (IDR)</span><input class="fl-input fl-mono" inputMode="numeric" value={amount} onInput={(e) => setAmount(e.target.value)} /></label>
        <button class="fl-btn fl-btn--red fl-btn--block" disabled={!name.trim()}>{old ? 'Save budget' : 'Add budget'}</button>
        {old && <button type="button" class="fl-linkbtn fl-quiet" onClick={save(false)}>Close this budget</button>}
      </form>
    </Sheet>
  );
}

export const BudgetRows = ({ rows }) => rows.map((b) => (
  <a key={b.id} class="fl-line" href={`#/budgets/${b.id}`}>
    <span><span class="fl-t__title">{b.name}</span>{b.pending > 0 && <span class="fl-t__meta">{b.pending} pending</span>}</span>
    <b class={`fl-mono${b.remaining < 0 ? ' fl-late' : ''}`}>{idr(b.remaining)}</b>
  </a>
));

// Treasurers and the Teacher: what needs a decision, what looks off, who to pay.
function TreasurerView() {
  const pending = S.purchases.filter((p) => p.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
  const flags = S.purchases.filter((p) => p.status === 'bought' && flagged(p)), open = batches(S.purchases, S.members);
  return (
    <>
      {pending.length > 0 ? <Section title="Pending approvals" n={pending.length}>{pending.map((p) => <PurchaseRow key={p.id} p={p} who />)}</Section> : <Quiet>No requests are waiting for approval.</Quiet>}
      {flags.length > 0 && <Section title="Flagged" n={flags.length} tone="is-late">{flags.map((p) => <PurchaseRow key={p.id} p={p} who />)}</Section>}
      {open.length ? open.map((b) => (
        <Section key={b.id} title={`Batch ${batchName(b.id)}`} n={idr(b.total)}>
          {b.pay.map((x) => <div key={x.uid} class="fl-line"><span>Pay {x.name}</span><b class="fl-mono">{idr(x.amount)}</b></div>)}
          {isTreasurer() && <button class="fl-btn fl-btn--ghost fl-btn--block" onClick={() => payBatch(b)}>Mark batch paid</button>}
        </Section>
      )) : <Quiet>No receipts are waiting to be paid back.</Quiet>}
    </>
  );
}

export function Budgets({ id }) {
  const [form, setForm] = useState(null);
  useEffect(() => { document.title = 'Budgets · Council'; }, []);
  const rows = budgetRows(S.budgets, S.purchases), one = id && S.budgets.find((b) => b.id === id);
  if (one) {
    const row = rows.find((b) => b.id === id) || { ...one, remaining: 0 }, list = S.purchases.filter((p) => p.budgetId === id).sort((a, b) => b.createdAt - a.createdAt);
    return (
      <>
        <a class="fl-linkbtn fl-quiet" href="#/budgets">All budgets</a>
        <div><h1 class="fl-h2">{one.name}</h1><p class={`fl-money fl-mono${row.remaining < 0 ? ' fl-late' : ''}`}>{idr(row.remaining)}</p><p class="fl-small fl-muted">left of {idr(one.amountIdr)}{!one.active && ' · closed'}</p></div>
        {list.length ? <Section title="Requests" n={list.length}>{list.map((p) => <PurchaseRow key={p.id} p={p} who />)}</Section> : <Quiet>No requests yet. Tap + to ask for a purchase.</Quiet>}
        {canBudget() && <button class="fl-linkbtn fl-quiet" onClick={() => setForm(one)}>Edit budget</button>}
        {form && <BudgetForm old={form} close={() => setForm(null)} />}
      </>
    );
  }
  const mine = S.purchases.filter((p) => p.requesterUid === S.me.id && !['paid', 'rejected', 'vetoed'].includes(p.status)).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <>
      {(isTreasurer() || S.me.role === 'advisor') && <TreasurerView />}
      {rows.length ? <Section title="Budgets"><BudgetRows rows={rows} /></Section> : <Quiet>No budgets yet.{canBudget() ? '' : ' A treasurer adds the first one.'}</Quiet>}
      {mine.length > 0 && <Section title="My requests" n={mine.length}>{mine.map((p) => <PurchaseRow key={p.id} p={p} />)}</Section>}
      {canBudget() && <button class="fl-linkbtn fl-quiet" onClick={() => setForm(true)}>New budget</button>}
      {form && <BudgetForm old={null} close={() => setForm(null)} />}
    </>
  );
}
