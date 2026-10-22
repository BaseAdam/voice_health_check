import { Link, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { answersFor, type YesNo } from '../src/domain/checkin';
import { evaluate } from '../src/domain/evaluate';
import { planReminders } from '../src/domain/reminders';
import { formatWhen, toISODate } from '../src/format';
import { useNotificationPermission } from '../src/reminders';
import { useStore } from '../src/store';
import { ActionBar, Button, colors, layout, text } from '../src/ui';

const MARKS: Record<YesNo, { mark: string; spoken: string; color: string }> = {
  yes: { mark: '✓', spoken: 'zrobione', color: colors.leaf },
  no: { mark: '✗', spoken: 'jeszcze nie', color: colors.muted },
};

type MenuItem = { href: Href; label: string };
const MENU: MenuItem[] = [
  { href: '/plan', label: 'Twój plan' },
  { href: '/results', label: 'Edytuj wyniki' },
  { href: '/summary', label: 'Podsumowanie dnia' },
  { href: '/settings', label: 'Ustawienia' },
];

/** Current time, refreshed when the screen regains focus or the app comes back (e.g. the next morning). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(new Date()));
      return () => sub.remove();
    }, []),
  );
  return now;
}

function NavList({ items }: { items: MenuItem[] }) {
  return (
    <View style={styles.list}>
      {/* Not <Link asChild>: its Slot spreads `style`, which drops Pressable's style function. */}
      {items.map((item, i) => (
        <Pressable
          key={item.label}
          accessibilityRole="link"
          accessibilityLabel={item.label}
          onPress={() => router.push(item.href)}
          style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
        >
          <Text style={[text.body, styles.grow]}>{item.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Today() {
  const results = useStore((s) => s.results);
  const today = useStore((s) => s.today);
  const reminders = useStore((s) => s.reminders);
  const { granted } = useNotificationPermission();
  const now = useNow();

  if (!results) {
    return (
      <View style={layout.screen}>
        <ScrollView contentContainerStyle={layout.content}>
          <Text style={text.title}>Zacznij od wyników badań</Text>
          <Text style={text.body}>
            Na ich podstawie aplikacja ułoży codzienne nawyki i będzie o nie pytać głosem.
          </Text>
          <NavList items={MENU.slice(-1)} />
        </ScrollView>
        <ActionBar>
          <Button title="Wpisz wyniki" onPress={() => router.push('/results')} />
        </ActionBar>
      </View>
    );
  }

  const habits = evaluate(results.values, results.sex, now, results.ranges).habits;
  const answers = answersFor(today, toISODate(now));
  const next = planReminders(habits, answers, reminders, now)[0];

  return (
    <View style={layout.screen}>
      <ScrollView contentContainerStyle={layout.content}>
        <Text style={text.heading}>Nawyki na dziś</Text>
        {habits.length === 0 ? (
          <Text style={text.body}>Wszystkie podane wyniki są w normie – nie ma nawyków do sprawdzania.</Text>
        ) : (
          <View style={styles.list}>
            {habits.map((h, i) => {
              const answer = answers[h.category];
              return (
                <View
                  key={h.category}
                  style={[styles.row, i > 0 && styles.divider]}
                  accessible
                  accessibilityLabel={`${h.label}: ${answer ? MARKS[answer].spoken : 'jeszcze nie pytano'}`}
                >
                  <Text style={[styles.mark, { color: answer ? MARKS[answer].color : colors.muted }]}>
                    {answer ? MARKS[answer].mark : '–'}
                  </Text>
                  <Text style={[text.body, styles.grow]}>{h.label}</Text>
                  {answer ? null : <Text style={text.muted}>jeszcze nie pytano</Text>}
                </View>
              );
            })}
          </View>
        )}

        {habits.length > 0 && granted === false ? (
          <Text style={text.muted}>
            Przypomnienia są wyłączone.{' '}
            <Link href="/settings" style={text.link}>
              Włącz w ustawieniach
            </Link>
          </Text>
        ) : null}
        {habits.length > 0 && granted ? (
          <Text style={text.muted}>
            {next ? `Następne przypomnienie: ${formatWhen(next.date, now)}` : 'Brak zaplanowanych przypomnień.'}
          </Text>
        ) : null}

        <NavList items={MENU} />
      </ScrollView>
      {habits.length > 0 ? (
        <ActionBar>
          <Button title="Check-in teraz" onPress={() => router.push('/checkin')} />
        </ActionBar>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pressed: { opacity: 0.6 },
  grow: { flex: 1 },
  mark: { fontSize: 20, fontWeight: '700', width: 22, textAlign: 'center' },
  chevron: { fontSize: 24, color: colors.muted },
});
