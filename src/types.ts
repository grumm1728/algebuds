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

export type ChatMessage = {
  id: string
  petId: string
  sender: 'pet' | 'student'
  text: string
}

export type DemoSuggestion = {
  id: string
  student: string
  bot: string
}

export type DemoScript = {
  id: string
  petId: string
  title: string
  opening: string
  problem: string
  readyMessage: string
  suggestions: DemoSuggestion[]
  whiteboardSteps: WhiteboardLine[]
  feedback: DemoSuggestion
}

export type WhiteboardLine = {
  kind: 'equation' | 'comment'
  left?: string
  right?: string
  text: string
}

export type PetAttempt = {
  steps: WhiteboardLine[]
  error?: string
}
