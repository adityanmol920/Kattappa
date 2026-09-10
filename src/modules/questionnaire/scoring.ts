import type { Answers, Bias } from '../../types';
import { questions } from './data';
export function assess(answers: Answers): { score: number; bias: Bias; answered: number } {
  let score = 0, answered = 0;
  for (const [id, , options] of questions) {
    const option = options.find(([value]) => value === answers[id]);
    if (option) { answered++; score += option[2]; }
  }
  const threshold = Math.ceil(questions.length / 2);
  return { score, answered, bias: score >= threshold ? 'CE' : score <= -threshold ? 'PE' : 'LOCKED' };
}
