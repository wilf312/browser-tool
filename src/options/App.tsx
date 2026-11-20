import { RedirectRulesSection } from './RedirectRulesSection';
import { PathReplaceSection } from './PathReplaceSection';
import { MeetAutoJoinSection } from './MeetAutoJoinSection';
import { ReloadTimerSection } from './ReloadTimerSection';
import { SettingsTransferSection } from './SettingsTransferSection';

export function App() {
  return (
    <main>
      <h1>Nanatsudougu</h1>
      <RedirectRulesSection />
      <PathReplaceSection />
      <MeetAutoJoinSection />
      <ReloadTimerSection />
      <SettingsTransferSection />
    </main>
  );
}
