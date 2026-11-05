// The input is inside a capsule: put the web focus ring on that capsule.
import { useState } from 'react';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { useTally } from '@/lib/theme';

export function useSearchFocus() {
  const { colors: t } = useTally();
  const [focused, setFocused] = useState(false);
  return {
    containerStyle: Platform.OS === 'web' && focused ? {
      outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2, outlineColor: t.focus,
    } as ViewStyle : undefined,
    // `none` is CSS-only; never pass it to a native view.
    inputStyle: Platform.OS === 'web' ? { outlineStyle: 'none' } as unknown as TextStyle : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
