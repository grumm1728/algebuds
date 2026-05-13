export type KnowledgeKey =
  | 'isolate'
  | 'balance'
  | 'undo'
  | 'divide'
  | 'check'

export type KnowledgeState = Record<KnowledgeKey, number>

export type PetPersonality = 'careful' | 'bold' | 'dreamy'

export type RobotPetData = {
  id: string
  name: string
  color: 'blue' | 'yellow' | 'pink'
  personality: PetPersonality
  question: string
  start: { x: number; y: number }
  knowledge: KnowledgeState
  reaction: string
  chatCount: number
}

export type EquationProblem = {
  prompt: string
  correctSteps: string[]
  answer: string
}

export type PetAttempt = {
  steps: string[]
  error?: string
}

export type ChatMessage = {
  id: string
  petId: string
  sender: 'pet' | 'student'
  text: string
}
