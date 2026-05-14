import type { EquationProblem, KnowledgeKey, KnowledgeState, PetAttempt, PetPersonality } from './types'

export const knowledgeLabels: Record<KnowledgeKey, string> = {
  isolate: 'Isolate the variable',
  balance: 'Same thing to both sides',
  undo: 'Undo addition/subtraction first',
  divide: 'Divide by the coefficient',
  check: 'Check the answer',
}

const ideaMatchers: Record<KnowledgeKey, RegExp[]> = {
  isolate: [/isolat(e|ing|ed)/i, /get .* variable .* alone/i, /\bx\b.* alone/i],
  balance: [/both sides/i, /same thing/i, /keep .* balance/i, /whatever .* one side/i],
  undo: [/undo/i, /opposite operation/i, /subtract .* first/i, /add .* first/i, /addition|subtraction/i],
  divide: [/divide/i, /coefficient/i, /multiply.*inverse/i],
  check: [/check/i, /plug .* back/i, /substitut(e|ing)/i, /test .* answer/i],
}

export const problems: EquationProblem[] = [
  {
    prompt: '2x + 4 = 14',
    correctSteps: [
      'Start with 2x + 4 = 14.',
      'Subtract 4 from both sides: 2x = 10.',
      'Divide both sides by 2: x = 5.',
      'Check: 2(5) + 4 = 14, so x = 5.',
    ],
    answer: 'x = 5',
  },
  {
    prompt: 'x - 3 = 8',
    correctSteps: [
      'Start with x - 3 = 8.',
      'Add 3 to both sides: x = 11.',
      'Check: 11 - 3 = 8, so x = 11.',
    ],
    answer: 'x = 11',
  },
  {
    prompt: '3x - 6 = 12',
    correctSteps: [
      'Start with 3x - 6 = 12.',
      'Add 6 to both sides: 3x = 18.',
      'Divide both sides by 3: x = 6.',
      'Check: 3(6) - 6 = 12, so x = 6.',
    ],
    answer: 'x = 6',
  },
]

export function detectTeachingIdeas(text: string): KnowledgeKey[] {
  return (Object.keys(ideaMatchers) as KnowledgeKey[]).filter((key) =>
    ideaMatchers[key].some((matcher) => matcher.test(text)),
  )
}

export function improveKnowledge(
  current: KnowledgeState,
  ideas: KnowledgeKey[],
  amount = 1,
): KnowledgeState {
  return ideas.reduce(
    (next, idea) => ({ ...next, [idea]: Math.min(3, next[idea] + amount) }),
    { ...current },
  )
}

function hasGap(knowledge: KnowledgeState, key: KnowledgeKey) {
  return knowledge[key] < 2
}

export function buildPetAttempt(
  problem: EquationProblem,
  knowledge: KnowledgeState,
  personality: PetPersonality,
): PetAttempt {
  const boldSlip = personality === 'bold' && Math.random() < 0.34
  const dreamySlip = personality === 'dreamy' && Math.random() < 0.28

  if (hasGap(knowledge, 'undo') || (dreamySlip && problem.prompt.includes('+'))) {
    return {
      steps: [
        { kind: 'comment', text: `I see ${problem.prompt}.` },
        { kind: 'comment', text: 'I divide first because I spotted a number near x.' },
        { kind: 'comment', text: 'That gives a messy answer, so I guess x = 4.' },
      ],
      error: 'The pet divided too early instead of undoing addition or subtraction first.',
    }
  }

  if (hasGap(knowledge, 'balance') || boldSlip) {
    return {
      steps: [
        { kind: 'comment', text: `I see ${problem.prompt}.` },
        { kind: 'comment', text: 'I undo the extra number on the left side only.' },
        { kind: 'comment', text: 'The equation looks simpler, so my answer is probably done.' },
      ],
      error: 'The pet forgot to do the same operation to both sides.',
    }
  }

  if (hasGap(knowledge, 'divide') && problem.prompt.match(/^\d+x/)) {
    return {
      steps: [
        { kind: 'comment', text: `I see ${problem.prompt}.` },
        { kind: 'comment', text: 'I undo addition or subtraction on both sides.' },
        { kind: 'comment', text: 'I stop when the number is still attached to x.' },
      ],
      error: 'The pet did not divide by the coefficient to finish isolating x.',
    }
  }

  if (hasGap(knowledge, 'check') && Math.random() < 0.45) {
    return {
      steps: problem.correctSteps.slice(0, -1).map((step) => ({ kind: 'comment', text: step })),
      error: 'The pet found an answer but skipped checking it in the original equation.',
    }
  }

  return { steps: problem.correctSteps.map((step) => ({ kind: 'comment', text: step })) }
}
