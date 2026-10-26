import lockupDark from '../../design/builtbyjosef/logos/tab-lockup-dark.svg';
import lockupLight from '../../design/builtbyjosef/logos/tab-lockup-light.svg';
import { Title } from '../ui.jsx';

// The only place the builtbyjosef signature appears in this app.
export function About() {
  const dark = document.documentElement.dataset.theme !== 'light';
  return (
    <>
      <Title light="STJBS Council." bold="About" title="About" />
      <p class="jy-pre">One place for the student council to plan projects, check in once a week and run meetings. It feeds the WhatsApp and Google Chat groups; it does not replace them.</p>
      <div class="jy-section jy-signature">
        <img src={dark ? lockupDark : lockupLight} alt="builtbyjosef" />
        <p class="jy-mono">Version {__VERSION__}</p>
        <p>Built by Josef Yang</p>
      </div>
    </>
  );
}
