import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DISCLAIMER } from './domain/recommendations';

// "Burak i szałwia": colours of the foods the plan recommends (beetroot, legumes, greens), not clinic blue.
export const colors = {
  ink: '#1E2B2F',
  muted: '#5C6B6E',
  paper: '#F6F8F5',
  card: '#FFFFFF',
  line: '#E1E7E1',
  beet: '#8A1C4A',
  onBeet: '#FFFFFF',
  sage: '#DCE6DC',
  leaf: '#2E6B45',
  signal: '#C8102E',
  noteBg: '#FBEFD9',
  noteInk: '#6B4400',
};

export const text = StyleSheet.create({
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '600', color: colors.ink },
  body: { fontSize: 17, lineHeight: 24, color: colors.ink },
  muted: { fontSize: 15, lineHeight: 21, color: colors.muted },
  error: { fontSize: 15, lineHeight: 21, color: colors.signal },
  link: { color: colors.beet, fontWeight: '600', textDecorationLine: 'underline' },
});

export const layout = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 16 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 8 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 17,
    color: colors.ink,
  },
});

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

/**
 * primary – the screen's main action (one per screen), secondary – other actions,
 * quiet / danger – text-only actions that should not compete (Pomiń, Nie teraz, Usuń).
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, labels[variant]]}>{title}</Text>
    </Pressable>
  );
}

/** Scrolling content above, the screen's main action pinned in thumb reach, clear of the home indicator. */
export function ActionBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>{children}</View>;
}

export function Disclaimer() {
  return <Text style={styles.disclaimer}>{DISCLAIMER}</Text>;
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center' },
  primary: { alignSelf: 'stretch', minHeight: 56, borderRadius: 28, paddingHorizontal: 24, backgroundColor: colors.beet },
  secondary: { alignSelf: 'stretch', minHeight: 48, borderRadius: 24, paddingHorizontal: 20, backgroundColor: colors.sage },
  quiet: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 4 },
  danger: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 4 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  bar: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  disclaimer: {
    backgroundColor: colors.noteBg,
    color: colors.noteInk,
    fontSize: 15,
    lineHeight: 21,
    padding: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
});

const labels = StyleSheet.create({
  primary: { color: colors.onBeet },
  secondary: { color: colors.ink },
  quiet: { color: colors.beet },
  danger: { color: colors.signal },
});
