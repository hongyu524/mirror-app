export type ReflectionQuestionKey = 'support' | 'reframe' | 'boundary';

export type ReflectionQuestion = {
  key: ReflectionQuestionKey;
  label: string;
  question: string;
  answers: {
    id: string;
    label: string;
    nextStep: string;
    cta: string;
    ctaType?: 'draft_text' | 'find_options' | 'set_reminder' | 'close' | 'add_note' | 'clarify' | 'save_reframe' | 'view_scripts' | 'choose_script' | 'improve_message' | 'log_outcome';
  }[];
};

export type DailyReflection = {
  id: string;
  user_id: string;
  date_key: string;
  support_answer?: string | null;
  reframe_answer?: string | null;
  boundary_answer?: string | null;
  completed_at?: string | null;
};

export const REFLECTION_QUESTIONS: ReflectionQuestion[] = [
  {
    key: 'support',
    label: 'SELF-CARE',
    question: 'Do I need outside support?',
    answers: [
      { id: 'Yes_professional', label: 'Yes, professional', nextStep: 'Consider professional support if this repeats.', cta: 'Find options', ctaType: 'find_options' },
      { id: 'Yes_friend', label: 'Yes, a friend', nextStep: 'Reach out to 1 friend today.', cta: 'Draft a text', ctaType: 'draft_text' },
      { id: 'Maybe', label: 'Maybe', nextStep: 'Wait 10 minutes and reassess.', cta: 'Set reminder', ctaType: 'set_reminder' },
      { id: 'Im_okay', label: "I'm okay", nextStep: 'Good. Protect your energy.', cta: 'Close', ctaType: 'close' },
      { id: 'Unsure', label: 'Unsure', nextStep: 'Wait 10 minutes and reassess.', cta: 'Set reminder', ctaType: 'set_reminder' },
    ],
  },
  {
    key: 'reframe',
    label: 'REFRAME',
    question: 'What if they meant well?',
    answers: [
      { id: 'Makes_sense', label: 'Makes sense', nextStep: 'Try a softer interpretation once.', cta: 'Save reframe', ctaType: 'save_reframe' },
      { id: 'Possible', label: 'Possible', nextStep: 'Try a softer interpretation once.', cta: 'Save reframe', ctaType: 'save_reframe' },
      { id: 'Neutral', label: 'Neutral', nextStep: 'Stay curious and look for evidence.', cta: 'Save reframe', ctaType: 'save_reframe' },
      { id: 'Unlikely', label: 'Unlikely', nextStep: 'Stick with your gut; protect your energy.', cta: 'Save reframe', ctaType: 'save_reframe' },
    ],
  },
  {
    key: 'boundary',
    label: 'BOUNDARY',
    question: 'Do I need a boundary here?',
    answers: [
      { id: 'Yes_now', label: 'Yes, right now', nextStep: 'State a clear limit once.', cta: 'Choose a script', ctaType: 'choose_script' },
      { id: 'Maybe_later', label: 'Maybe later', nextStep: 'Revisit after you feel calmer.', cta: 'Set reminder', ctaType: 'set_reminder' },
      { id: 'No', label: 'No', nextStep: 'Notice the pattern over time.', cta: 'Close', ctaType: 'close' },
      { id: 'Not_sure', label: 'Not sure', nextStep: 'Draft how you might say it.', cta: 'Draft a text', ctaType: 'draft_text' },
    ],
  },
];

export async function getTodayReflection(_userId: string): Promise<DailyReflection | null> {
  return null;
}

export async function saveReflectionAnswer(
  _userId: string,
  _reflectionId: string,
  _updates: Partial<DailyReflection>
): Promise<DailyReflection | null> {
  return null;
}

export async function getReflectionProgress(_userId: string) {
  return { completed: 0, total: 7 };
}
