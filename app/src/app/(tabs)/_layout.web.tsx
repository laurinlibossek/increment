// The browser scroll-snap navigator keeps every tab mounted side by side.
// NativeTabs and its native accessory remain in _layout.tsx.
import { useLang } from '@/lib/i18n';
import { ROOT_TABS } from '@/lib/tabs';
import { WebTabs } from '@/ui/WebTabPager.web';

export default function TabLayout() {
  const { tr } = useLang();
  return (
    <WebTabs activityEnabled={false} backBehavior="history">
      {ROOT_TABS.map(({ name, label }) => <WebTabs.Screen key={name} name={name} options={{ title: tr(label) }} />)}
    </WebTabs>
  );
}
