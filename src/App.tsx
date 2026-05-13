import { useMemo, useRef, useState } from 'react'
import './App.css'
import { buildPetAttempt, detectTeachingIdeas, improveKnowledge, knowledgeLabels, problems } from './algebra'
import { ClassroomScene } from './components/ClassroomScene'
import { DialogueInput } from './components/DialogueInput'
import type { ChatMessage, KnowledgeKey, PetAttempt, RobotPetData } from './types'

const blankKnowledge = {
  isolate: 0,
  balance: 0,
  undo: 0,
  divide: 0,
  check: 0,
}

const starterPets: RobotPetData[] = [
  {
    id: 'byte',
    name: 'Byte',
    color: 'blue',
    personality: 'careful',
    question: 'Can you teach me how to keep an equation balanced?',
    start: { x: 22, y: 62 },
    knowledge: { ...blankKnowledge, isolate: 1, balance: 1 },
    reaction: 'My circuits are listening.',
    chatCount: 0,
  },
  {
    id: 'nibi',
    name: 'Nibi',
    color: 'yellow',
    personality: 'bold',
    question: 'I like fast answers. What should I remember before I jump in?',
    start: { x: 52, y: 72 },
    knowledge: { ...blankKnowledge, undo: 1 },
    reaction: 'I am ready to zoom, carefully-ish.',
    chatCount: 0,
  },
  {
    id: 'pippa',
    name: 'Pippa',
    color: 'pink',
    personality: 'dreamy',
    question: 'If x wants to be alone, what kind thing do we do first?',
    start: { x: 76, y: 56 },
    knowledge: { ...blankKnowledge, check: 1 },
    reaction: 'Tiny math stars acquired.',
    chatCount: 0,
  },
]

function botResponse(ideas: KnowledgeKey[], isFeedback: boolean) {
  if (ideas.length === 0) return 'Can you say the strategy another way?'
  if (isFeedback) return 'Feedback patched. I will try that next time.'
  return `I learned: ${ideas.map((idea) => knowledgeLabels[idea]).join(', ')}.`
}

const starterMessages: ChatMessage[] = starterPets.flatMap((pet) => [
  {
    id: `${pet.id}-question`,
    petId: pet.id,
    sender: 'pet',
    text: pet.question,
  },
  {
    id: `${pet.id}-reaction`,
    petId: pet.id,
    sender: 'pet',
    text: pet.reaction,
  },
])

function App() {
  const [pets, setPets] = useState(starterPets)
  const [selectedPetId, setSelectedPetId] = useState(starterPets[0].id)
  const [teachingText, setTeachingText] = useState('')
  const [attempt, setAttempt] = useState<PetAttempt | null>(null)
  const [whiteboardOpen, setWhiteboardOpen] = useState(false)
  const [starPosition, setStarPosition] = useState<{ x: number; y: number } | null>(null)
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]
  const problem = problems[currentProblemIndex]
  const selectedMessages = messages.filter((message) => message.petId === selectedPetId)

  const detectedIdeas = useMemo(() => detectTeachingIdeas(teachingText), [teachingText])

  function updateSelectedPet(updater: (pet: RobotPetData) => RobotPetData) {
    setPets((currentPets) =>
      currentPets.map((pet) => (pet.id === selectedPetId ? updater(pet) : pet)),
    )
  }

  function handleSelectPet(id: string) {
    setSelectedPetId(id)
    setAttempt(null)
    setWhiteboardOpen(false)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleTeach() {
    const ideas = detectTeachingIdeas(teachingText)
    const trimmedText = teachingText.trim()
    if (!trimmedText) return

    const isFeedback = attempt !== null
    const response = botResponse(ideas, isFeedback)
    updateSelectedPet((pet) => ({
      ...pet,
      knowledge: improveKnowledge(pet.knowledge, ideas, isFeedback ? 2 : 1),
      chatCount: pet.chatCount + 1,
      reaction: response,
    }))
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `${selectedPetId}-student-${Date.now()}`,
        petId: selectedPetId,
        sender: 'student',
        text: trimmedText,
      },
      {
        id: `${selectedPetId}-pet-${Date.now()}`,
        petId: selectedPetId,
        sender: 'pet',
        text: response,
      },
    ])
    setTeachingText('')
    if (isFeedback && ideas.length > 0) {
      setCurrentProblemIndex((index) => (index + 1) % problems.length)
      setAttempt(null)
      setWhiteboardOpen(false)
    }
  }

  function handlePetTry() {
    const nextAttempt = buildPetAttempt(problem, selectedPet.knowledge, selectedPet.personality)
    setAttempt(nextAttempt)
    setWhiteboardOpen(true)
    setStarPosition(null)
    updateSelectedPet((pet) => ({
      ...pet,
      reaction: nextAttempt.error ? 'I tried, but I may need a hint.' : 'Beep-beep, that felt correct!',
    }))
  }

  return (
    <main className="app">
      <ClassroomScene
        pets={pets}
        selectedPetId={selectedPetId}
        problem={problem}
        attempt={whiteboardOpen ? attempt : null}
        starPosition={starPosition}
        onSelectPet={handleSelectPet}
        onPetTry={handlePetTry}
        onCloseWhiteboard={() => setWhiteboardOpen(false)}
        onPlaceStar={setStarPosition}
      />

      <aside className="coach-panel" aria-label="Algebuds teaching panel">
        <section className="panel-card pet-picker">
          <p className="eyebrow">Choose an Algebud</p>
          <div className="pet-tabs">
            {pets.map((pet) => (
              <button
                key={pet.id}
                className={pet.id === selectedPetId ? 'active' : ''}
                type="button"
                onClick={() => handleSelectPet(pet.id)}
              >
                <span className={`mini-dot mini-dot--${pet.color}`} />
                {pet.name}
              </button>
            ))}
          </div>
        </section>

        <DialogueInput
          value={teachingText}
          selectedPetName={selectedPet.name}
          selectedPetColor={selectedPet.color}
          messages={selectedMessages}
          hasAttempt={attempt !== null}
          detectedIdeas={detectedIdeas}
          ideaLabels={knowledgeLabels}
          inputRef={inputRef}
          onChange={setTeachingText}
          onSubmit={handleTeach}
        />
      </aside>

    </main>
  )
}

export default App
