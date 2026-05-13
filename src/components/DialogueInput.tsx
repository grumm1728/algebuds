import type { RefObject } from 'react'
import type { ChatMessage, KnowledgeKey, RobotPetData } from '../types'

type DialogueInputProps = {
  value: string
  selectedPetName: string
  selectedPetColor: RobotPetData['color']
  messages: ChatMessage[]
  hasAttempt: boolean
  detectedIdeas: KnowledgeKey[]
  ideaLabels: Record<KnowledgeKey, string>
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onSubmit: () => void
}

export function DialogueInput({
  value,
  selectedPetName,
  selectedPetColor,
  messages,
  hasAttempt,
  detectedIdeas,
  ideaLabels,
  inputRef,
  onChange,
  onSubmit,
}: DialogueInputProps) {
  return (
    <section className={`panel-card dialogue-panel dialogue-panel--${selectedPetColor}`} aria-label="Pet chat">
      <div className="chat-log">
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
      </div>
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
