import { LearnerLevel } from '../../shared/types';

type StarterLevel = 'A1' | 'A2' | 'B1';

export const EXTERNAL_PLACEMENT_URL = 'https://www.efset.org/ef-set-50/';

interface Question {
  level: StarterLevel;
  text: string;
  prompt?: string;
  options: readonly string[];
  correct: number;
}

export const PLACEMENT_QUESTIONS: readonly Question[] = [
  { level: 'A1', text: 'I’m thirsty. Can I have some ___?', options: ['bread', 'water', 'rice', 'salt'], correct: 1 },
  { level: 'A1', text: 'The shop opens at nine and closes at six.', prompt: 'When does the shop open?', options: ['At six', 'At noon', 'At seven', 'At nine'], correct: 3 },
  { level: 'A1', text: 'I need to ___ my hands before dinner.', options: ['wash', 'wear', 'read', 'open'], correct: 0 },
  { level: 'A1', text: 'My brother is my parents’ ___.', options: ['uncle', 'father', 'son', 'grandfather'], correct: 2 },
  { level: 'A2', text: 'Leo missed the bus, so he walked to school.', prompt: 'Why did Leo walk to school?', options: ['He wanted some exercise.', 'He had no school that day.', 'He didn’t catch the bus.', 'He got off at the wrong stop.'], correct: 2 },
  { level: 'A2', text: 'I left my wallet at home. Can I ___ five pounds from you until tomorrow?', options: ['borrow', 'lend', 'spend', 'earn'], correct: 0 },
  { level: 'A2', text: 'We’ve run out of milk. Could you buy some on your way home?', prompt: 'What does the speaker mean?', options: ['The milk is too cold.', 'They have enough milk.', 'They bought milk earlier.', 'There is no milk left.'], correct: 3 },
  { level: 'A2', text: 'The jacket doesn’t ___ me. The sleeves are too short.', options: ['match', 'fit', 'follow', 'cost'], correct: 1 },
  { level: 'B1', text: 'The match was put off until Saturday because of heavy rain.', prompt: 'What happened to the match?', options: ['It was moved to a later date.', 'It was cancelled for good.', 'It was played in the rain.', 'It was moved to an earlier date.'], correct: 0 },
  { level: 'B1', text: 'The job sounded ideal, but Nina turned it down because she would have to move.', prompt: 'What did Nina decide?', options: ['To move before starting', 'To ask for more money', 'To accept the offer', 'To refuse the offer'], correct: 3 },
  { level: 'B1', text: 'I could read the headline, but the smaller print was hard to make out.', prompt: 'What was difficult?', options: ['Finding the headline', 'Seeing the smaller words clearly', 'Writing a shorter headline', 'Printing more copies'], correct: 1 },
  { level: 'B1', text: 'Maya was reluctant to speak at first, but she agreed once she knew the group was small.', prompt: 'How did Maya feel at first?', options: ['Eager to begin', 'Sure she would do well', 'Unwilling to speak', 'Unable to hear the group'], correct: 2 },
];

export function recommendLevel(answers: readonly (number | null)[]): StarterLevel | null {
  if (answers.length !== PLACEMENT_QUESTIONS.length) return null;

  const correct = { A1: 0, A2: 0, B1: 0 };
  for (const [i, question] of PLACEMENT_QUESTIONS.entries()) {
    const answer = answers[i];
    if (answer !== null && (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length)) return null;
    if (answer === question.correct) correct[question.level]++;
  }

  if (correct.A1 < 3 || correct.A2 < 3) return 'A1';
  return correct.B1 >= 3 ? 'B1' : 'A2';
}

export function starterDeckName(level: LearnerLevel): string {
  return `Vocabulary ${level === 'A0' ? 'A1' : level === 'A1' || level === 'A2' ? level : 'B1'}`;
}
