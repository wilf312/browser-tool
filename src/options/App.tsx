import { RedirectRulesSection } from './RedirectRulesSection';
import { MeetAutoJoinSection } from './MeetAutoJoinSection';
import { SettingsTransferSection } from './SettingsTransferSection';

export function App() {
  return (
    <main>
      <h1>Nanatsudougu</h1>
      <RedirectRulesSection />
      <MeetAutoJoinSection />
      <SettingsTransferSection />
    </main>
  );
}
