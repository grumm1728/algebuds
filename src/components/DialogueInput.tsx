import { useEffect, useRef, type RefObject } from 'react'
import type { ChatMessage, DemoSuggestion, KnowledgeKey, RobotPetData } from '../types'

type DialogueInputProps = {
  value: string
  selectedPetName: string
  selectedPetColor: RobotPetData['color']
  messages: ChatMessage[]
  suggestions: DemoSuggestion[]
  hasAttempt: boolean
  isComplete: boolean
  detectedIdeas: KnowledgeKey[]
  ideaLabels: Record<KnowledgeKey, string>
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onSubmit: () => void
  onSuggestion: (suggestion: DemoSuggestion) => void
}

export function DialogueInput({
  value,
  selectedPetName,
  selectedPetColor,
  messages,
  suggestions,
  hasAttempt,
  isComplete,
  detectedIdeas,
  ideaLabels,
  inputRef,
  onChange,
  onSubmit,
  onSuggestion,
}: DialogueInputProps) {
  const chatLogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    chatLogRef.current?.scrollTo({
      top: chatLogRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  return (
    <section className={`panel-card dialogue-panel dialogue-panel--${selectedPetColor}`} aria-label="Pet chat">
      <div className="chat-log" ref={chatLogRef}>
        {messages.map((message) => (
          <div
            className={`chat-row chat-row--${message.sender}`}
            key={message.id}
          >
            <div className={`chat-bubble chat-bubble--${message.sender}`}>
              <strong>{message.sender === 'pet' ? selectedPetName : 'You'}</strong>
              <span>{message.text}</span>
            </div>
          </div>
        ))}
        {isComplete && (
          <div className="demo-complete" aria-live="polite">
            Demo complete
          </div>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="suggestion-tray" aria-label="Suggested messages">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onSuggestion(suggestion)}
            >
              {suggestion.student}
            </button>
          ))}
        </div>
      )}
      <form
        className="dialogue-input"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={hasAttempt ? "Give feedback on the pet's work..." : 'Type your teaching here...'}
          aria-label="Teaching input"
        />
        <button type="submit">Enter</button>
      </form>
      {detectedIdeas.length > 0 && (
        <div className="idea-preview" aria-live="polite">
          {detectedIdeas.map((idea) => <span key={idea}>{ideaLabels[idea]}</span>)}
        </div>
      )}
    </section>
  )
}
