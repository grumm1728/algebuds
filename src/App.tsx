import { useMemo, useRef, useState } from 'react'
import './App.css'
import { buildPetAttempt, detectTeachingIdeas, improveKnowledge, knowledgeLabels, problems } from './algebra'
import { AlgebraKitchenMode } from './components/AlgebraKitchenMode'
import { ClassroomScene } from './components/ClassroomScene'
import { DialogueInput } from './components/DialogueInput'
import { getDemoScriptForPet } from './demoScripts'
import type { ChatMessage, DemoSuggestion, KnowledgeKey, PetAttempt, RobotPetData } from './types'

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
    text: getDemoScriptForPet(pet.id)?.opening || pet.question,
  },
  {
    id: `${pet.id}-reaction`,
    petId: pet.id,
    sender: 'pet',
    text: pet.reaction,
  },
])

function App() {
  const [mode, setMode] = useState<'classroom' | 'kitchen'>('classroom')
  const [pets, setPets] = useState(starterPets)
  const [selectedPetId, setSelectedPetId] = useState(starterPets[0].id)
  const [teachingText, setTeachingText] = useState('')
  const [attempt, setAttempt] = useState<PetAttempt | null>(null)
  const [whiteboardOpen, setWhiteboardOpen] = useState(false)
  const [starPosition, setStarPosition] = useState<{ x: number; y: number } | null>(null)
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages)
  const [scriptProgress, setScriptProgress] = useState<Record<string, number>>({})
  const [feedbackPrompted, setFeedbackPrompted] = useState(false)
  const [completedScripts, setCompletedScripts] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]
  const selectedScript = getDemoScriptForPet(selectedPetId)
  const selectedScriptProgress = scriptProgress[selectedPetId] ?? 0
  const selectedScriptComplete = Boolean(completedScripts[selectedPetId])
  const problem = selectedScript
    ? {
        prompt: selectedScript.problem,
        correctSteps: selectedScript.whiteboardSteps.map((line) => line.text),
        answer: selectedScript.whiteboardSteps.at(-1)?.text ?? '',
      }
    : problems[currentProblemIndex]
  const selectedMessages = messages.filter((message) => message.petId === selectedPetId)
  const visibleSuggestions = selectedScript && !selectedScriptComplete
    ? starPosition && attempt
      ? [selectedScript.feedback]
      : selectedScript.suggestions.slice(selectedScriptProgress, selectedScriptProgress + 2)
    : []
  const canPetTry = !attempt && !selectedScriptComplete && (selectedScript
    ? selectedScriptProgress >= selectedScript.suggestions.length
    : selectedPet.chatCount > 0)

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
    setFeedbackPrompted(false)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function sendStudentMessage(messageText: string) {
    const trimmedText = messageText.trim()
    if (!trimmedText) return

    const scriptedSuggestion = selectedScript?.suggestions[selectedScriptProgress]
    const scriptMatched = scriptedSuggestion?.student === trimmedText
    const feedbackMatched = Boolean(selectedScript && attempt && trimmedText === selectedScript.feedback.student)
    const ideas = detectTeachingIdeas(trimmedText)
    const isFeedback = attempt !== null
    const response = feedbackMatched
      ? selectedScript?.feedback.bot ?? 'Thanks. I see what to fix now.'
      : scriptMatched
        ? scriptedSuggestion.bot
        : botResponse(ideas, isFeedback)
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
    if (scriptMatched) {
      setScriptProgress((currentProgress) => ({
        ...currentProgress,
        [selectedPetId]: selectedScriptProgress + 1,
      }))
    }
    setTeachingText('')
    if (feedbackMatched) {
      window.setTimeout(() => {
        setAttempt(null)
        setWhiteboardOpen(false)
        setStarPosition(null)
        setFeedbackPrompted(false)
        setCompletedScripts((currentCompleted) => ({
          ...currentCompleted,
          [selectedPetId]: true,
        }))
      }, 950)
      return
    }

    if (isFeedback && ideas.length > 0) {
      setCurrentProblemIndex((index) => (index + 1) % problems.length)
      setAttempt(null)
      setWhiteboardOpen(false)
    }
  }

  function handleTeach() {
    sendStudentMessage(teachingText)
  }

  function handleSuggestion(suggestion: DemoSuggestion) {
    sendStudentMessage(suggestion.student)
  }

  function handlePetTry() {
    const nextAttempt = selectedScript && canPetTry
      ? { steps: selectedScript.whiteboardSteps }
      : buildPetAttempt(problem, selectedPet.knowledge, selectedPet.personality)
    setAttempt(nextAttempt)
    setWhiteboardOpen(true)
    setStarPosition(null)
    setFeedbackPrompted(false)
    updateSelectedPet((pet) => ({
      ...pet,
      reaction: nextAttempt.error ? 'I tried, but I may need a hint.' : 'Beep-beep, that felt correct!',
    }))
  }

  function handlePlaceStar(position: { x: number; y: number }) {
    setStarPosition(position)

    if (!feedbackPrompted) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${selectedPetId}-pet-feedback-${Date.now()}`,
          petId: selectedPetId,
          sender: 'pet',
          text: 'Can you leave me feedback on my whiteboard work?',
        },
      ])
      setFeedbackPrompted(true)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  return (
    <main className={`app app--${mode}`}>
      <nav className="mode-switch" aria-label="Algebuds mode switcher">
        <button
          className={mode === 'classroom' ? 'active' : ''}
          type="button"
          onClick={() => setMode('classroom')}
        >
          Classroom
        </button>
        <button
          className={mode === 'kitchen' ? 'active' : ''}
          type="button"
          onClick={() => setMode('kitchen')}
        >
          Algebra Kitchen
        </button>
      </nav>

      {mode === 'kitchen' ? (
        <AlgebraKitchenMode />
      ) : (
        <>
          <ClassroomScene
            pets={pets}
            selectedPetId={selectedPetId}
            problem={problem}
            attempt={whiteboardOpen ? attempt : null}
            starPosition={starPosition}
            onSelectPet={handleSelectPet}
            onPetTry={handlePetTry}
            canPetTry={canPetTry}
            onCloseWhiteboard={() => setWhiteboardOpen(false)}
            onPlaceStar={handlePlaceStar}
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
              suggestions={visibleSuggestions}
              hasAttempt={attempt !== null}
              isComplete={selectedScriptComplete}
              detectedIdeas={detectedIdeas}
              ideaLabels={knowledgeLabels}
              inputRef={inputRef}
              onChange={setTeachingText}
              onSubmit={handleTeach}
              onSuggestion={handleSuggestion}
            />
          </aside>
        </>
      )}
    </main>
  )
}

export default App
