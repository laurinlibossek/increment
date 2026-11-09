// One order for the native bar, web bar and content-swipe shortcut.
export const ROOT_TABS = [
  { name: 'index', label: 'Today', href: '/(tabs)', pathname: '/' },
  { name: 'plan', label: 'Plan', href: '/(tabs)/plan', pathname: '/plan' },
  { name: 'progress', label: 'Progress', href: '/(tabs)/progress', pathname: '/progress' },
] as const;

export type RootTab = (typeof ROOT_TABS)[number]['name'];
