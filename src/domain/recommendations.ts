import type { MarkerId } from './markers';

export type Direction = 'low' | 'high';
export type ReminderTime = 'morning' | 'lunch' | 'evening';
export type HabitCategory =
  | 'vit_d_food'
  | 'iron_food'
  | 'b12_food'
  | 'fiber'
  | 'vegetables'
  | 'vit_d_supplement';

export type Habit = {
  category: HabitCategory;
  /** Short name for day summaries. */
  label: string;
  foods: string[];
  /** Check-in question, gender-neutral. */
  question: string;
  /** Said after "yes". */
  yesText: string;
  /** Tip for the rest of the day, said after "no". */
  noTip: string;
  /** Local notification body; fits any time of day. */
  reminder: string;
  time: ReminderTime;
  /** Mandatory for supplements. */
  note?: string;
};

/** No habit = diet is not the answer for this direction; the explanation sends the user to a doctor. */
export type Recommendation = { explanation: string; habit?: Habit };

export const DISCLAIMER = 'Aplikacja nie zastępuje konsultacji z lekarzem.';
export const REMINDER_TIME_LABELS: Record<ReminderTime, string> = {
  morning: 'rano',
  lunch: 'obiad',
  evening: 'wieczór',
};
export const SUPPLEMENT_NOTE =
  'Suplementację skonsultuj z lekarzem lub farmaceutą i przeczytaj ulotkę.';

// Content rules: no doses of drugs or supplements; questions in gender-neutral form.

const IRON_HABIT: Habit = {
  category: 'iron_food',
  label: 'produkty bogate w żelazo',
  foods: ['soczewica', 'ciecierzyca', 'fasola', 'chuda wołowina', 'natka pietruszki', 'pestki dyni'],
  question: 'Czy udało Ci się dziś zjeść coś bogatego w żelazo, na przykład strączki albo chude mięso?',
  yesText:
    'Dobrze! Żelazo lepiej się wchłania, gdy do posiłku dodasz warzywa bogate w witaminę C, na przykład paprykę.',
  noTip:
    'Do kolacji dodaj pastę z ciecierzycy albo garść pestek dyni i paprykę – witamina C pomaga wchłaniać żelazo.',
  reminder: 'Dziś warto zjeść coś bogatego w żelazo, na przykład strączki albo chude mięso.',
  time: 'lunch',
};

export const VIT_D_SUPPLEMENT_HABIT: Habit = {
  category: 'vit_d_supplement',
  label: 'suplement witaminy D',
  foods: [],
  question: 'Czy udało Ci się dziś przyjąć suplement witaminy D?',
  yesText: 'Dobrze! Przy suplementacji liczy się regularność.',
  noTip: 'Witamina D rozpuszcza się w tłuszczach, więc najlepiej przyjmować ją z posiłkiem.',
  reminder: 'Pamiętaj o suplemencie witaminy D – najlepiej z posiłkiem.',
  time: 'morning',
  note: SUPPLEMENT_NOTE,
};

export const RECOMMENDATIONS: Record<MarkerId, Partial<Record<Direction, Recommendation>>> = {
  vitD: {
    low: {
      explanation:
        'Niski poziom witaminy D jest w Polsce częsty, zwłaszcza od jesieni do wiosny. Witamina D wspiera kości, mięśnie i odporność.',
      habit: {
        category: 'vit_d_food',
        label: 'tłusta ryba lub jajka',
        foods: ['łosoś', 'makrela', 'śledź', 'sardynki', 'jaja'],
        question: 'Czy udało Ci się dziś zjeść tłustą rybę albo jajka?',
        yesText: 'Świetnie! Tłuste ryby i jajka to jedne z niewielu naturalnych źródeł witaminy D.',
        noTip: 'Na kolację możesz zjeść jajko albo kanapkę z makrelą lub śledziem.',
        reminder: 'Dziś warto zjeść tłustą rybę albo jajka – to naturalne źródła witaminy D.',
        time: 'lunch',
      },
    },
    high: {
      explanation:
        'Wysoki poziom witaminy D najczęściej wynika z suplementacji. Omów wynik z lekarzem, zanim przyjmiesz kolejne preparaty z witaminą D.',
    },
  },
  ferritin: {
    low: {
      explanation:
        'Ferrytyna pokazuje zapasy żelaza w organizmie. Niski wynik może oznaczać ich wyczerpanie, nawet przy prawidłowej hemoglobinie.',
      habit: IRON_HABIT,
    },
    high: {
      explanation: 'Wysoka ferrytyna może mieć różne przyczyny, na przykład stan zapalny. Omów wynik z lekarzem.',
    },
  },
  hemoglobin: {
    low: {
      explanation:
        'Niska hemoglobina może oznaczać niedokrwistość, często z niedoboru żelaza. Omów wynik z lekarzem.',
      habit: IRON_HABIT,
    },
    high: {
      explanation:
        'Podwyższona hemoglobina może wynikać na przykład z odwodnienia lub palenia tytoniu. Omów wynik z lekarzem.',
    },
  },
  b12: {
    low: {
      explanation:
        'Witamina B12 jest potrzebna do tworzenia krwinek i pracy układu nerwowego. Występuje głównie w produktach odzwierzęcych.',
      habit: {
        category: 'b12_food',
        label: 'produkty z witaminą B12',
        foods: ['ryby', 'jaja', 'jogurt naturalny', 'ser', 'mięso'],
        question: 'Czy udało Ci się dziś zjeść jajka, rybę albo nabiał?',
        yesText: 'Świetnie! Regularne porcje takich produktów pomagają utrzymać poziom witaminy B12.',
        noTip: 'Na kolację wybierz jajko, rybę albo jogurt naturalny.',
        reminder: 'Dziś warto zjeść jajka, rybę albo nabiał – to źródła witaminy B12.',
        time: 'morning',
      },
    },
    high: {
      explanation: 'Wysoki poziom witaminy B12 najczęściej wynika z suplementacji. Omów wynik z lekarzem.',
    },
  },
  ldl: {
    high: {
      explanation:
        'Podwyższony cholesterol LDL zwiększa ryzyko chorób serca. Pomaga błonnik rozpuszczalny i ograniczenie tłuszczów nasyconych.',
      habit: {
        category: 'fiber',
        label: 'posiłek z błonnikiem',
        foods: ['płatki owsiane', 'soczewica', 'fasola', 'jabłka', 'orzechy'],
        question: 'Czy udało Ci się dziś zjeść owsiankę albo inny posiłek bogaty w błonnik?',
        yesText: 'Brawo! Błonnik z owsa i strączków pomaga obniżać cholesterol LDL.',
        noTip: 'Do kolacji dodaj porcję strączków albo zjedz jabłko i garść orzechów.',
        reminder: 'Dziś warto zjeść owsiankę albo inny posiłek bogaty w błonnik.',
        time: 'morning',
      },
    },
  },
  glucose: {
    low: {
      explanation: 'Glukoza na czczo poniżej normy wymaga wyjaśnienia. Omów wynik z lekarzem.',
    },
    high: {
      explanation:
        'Glukoza na czczo powyżej normy może oznaczać zaburzenia gospodarki cukrowej. Omów wynik z lekarzem – pomaga też dieta bogata w warzywa i pełne ziarno.',
      habit: {
        category: 'vegetables',
        label: 'warzywa do posiłków',
        foods: ['warzywa', 'kasza gryczana', 'pieczywo pełnoziarniste', 'rośliny strączkowe'],
        question: 'Czy udało Ci się dziś dodać warzywa do każdego głównego posiłku?',
        yesText: 'Świetnie! Warzywa i błonnik spowalniają wchłanianie cukru.',
        noTip: 'Kolację zacznij od porcji warzyw, a słodycze zamień na owoc albo orzechy.',
        reminder: 'Dodaj warzywa do najbliższego posiłku.',
        time: 'lunch',
      },
    },
  },
};
