import { useState } from 'preact/hooks';
import { S, memberName, toast } from '../store.js';
import { STAGES, activeMembers, checksIn, isBoss, personStatus, taskState } from '../model.js';
import { putDoc } from '../actions.js';
import { dayStartMs, idr, week } from '../time.js';
import { Title } from '../ui.jsx';

export const DEFAULT_DIGEST = {
  template: '*STJBS Council · {week}*\n\n{done}\n\n{overdue}\n\n{blocked}\n\n{deals}\n\nDetails and check-ins are on the dashboard.',
  sections: { done: true, overdue: true, blocked: true, deals: true },
};
const LABELS = { done: 'Done this week', overdue: 'Overdue', blocked: 'Blocked', deals: 'Deals' };

export function buildDigest({ template, sections }) {
  const w = week(), tasks = S.items.filter((t) => t.kind === 'task');
  const who = (t) => (t.assigneeUids.length ? ` (${t.assigneeUids.map(memberName).join(', ')})` : '');
  const lines = {
    done: tasks.filter((t) => t.status === 'done' && t.completedAt >= dayStartMs(w.start)).map((t) => `- ${t.title}${who(t)}`),
    overdue: tasks.filter((t) => taskState(t).word === 'Overdue').map((t) => `- ${t.title}${who(t)}, due ${t.dueDate}`),
    blocked: [...tasks.filter((t) => t.blocked && t.status !== 'done').map((t) => `- ${t.title}${who(t)}${t.blockedReason ? `: "${t.blockedReason}"` : ''}`),
      ...activeMembers().filter(checksIn).map((m) => personStatus(m.id)).filter((s) => s.blocked).map((s) => `- ${s.line}`)],
    deals: tasks.filter((t) => t.isDeal).map((t) => `- ${t.title}: stage ${STAGES.indexOf(t.dealStage) + 1} of 4 (${t.dealStage}), pledged ${idr(t.pledgedIdr)}, received ${idr(t.receivedIdr)}`),
  };
  const values = { week: w.id };
  for (const k in LABELS) values[k] = sections[k] ? `*${LABELS[k]}*\n${lines[k].join('\n') || '- None'}` : '';
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m)).replace(/\n{3,}/g, '\n\n').trim();
}

export function Digest() {
  const [d, setD] = useState(() => ({ ...DEFAULT_DIGEST, ...S.digest, sections: { ...DEFAULT_DIGEST.sections, ...S.digest?.sections } }));
  const text = buildDigest(d), edit = isBoss() && S.me.role !== 'teacher';
  const copy = () => navigator.clipboard.writeText(text).then(() => toast('Digest copied. Paste it into the chat.'), () => toast('Copy failed. Select the preview text and copy it by hand.'));
  return (
    <>
      <Title light="For the chats." bold="Weekly digest." title="Digest" />
      <div class="fl-actions">
        <button class="fl-btn fl-btn--red" onClick={copy}>Copy digest</button>
        <a class="fl-btn fl-btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a>
      </div>
      <section class="fl-section" aria-labelledby="pv-h"><h2 id="pv-h" class="fl-h2">Preview</h2>
        <pre class="fl-digest">{text}</pre></section>
      {edit && (
        <section class="fl-panel fl-form" aria-labelledby="tpl-h"><h2 id="tpl-h" class="fl-h2">Template</h2>
          <p class="fl-caption">Placeholders: {'{week} {done} {overdue} {blocked} {deals}'}. Use *stars* for bold; WhatsApp and Google Chat both show it.</p>
          <fieldset class="fl-fieldset"><legend class="fl-field__label">Sections</legend>
            {Object.keys(LABELS).map((k) => <label key={k} class="fl-checkrow"><input type="checkbox" checked={d.sections[k]}
              onChange={(e) => setD({ ...d, sections: { ...d.sections, [k]: e.target.checked } })} />{LABELS[k]}</label>)}</fieldset>
          <label class="fl-field"><span class="fl-field__label">Template text</span>
            <textarea class="fl-input fl-mono" rows={10} value={d.template} onInput={(e) => setD({ ...d, template: e.target.value })} /></label>
          <div class="fl-actions"><button class="fl-btn fl-btn--ghost" onClick={() => putDoc('settings/digest', { template: d.template, sections: d.sections }, 'Template saved.')}>Save template</button>
            <button class="fl-btn fl-btn--ghost" onClick={() => setD(DEFAULT_DIGEST)}>Reset to default</button></div>
        </section>
      )}
    </>
  );
}
