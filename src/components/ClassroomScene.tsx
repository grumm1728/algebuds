import type { MouseEvent } from 'react'
import type { EquationProblem, PetAttempt, RobotPetData } from '../types'
import { ClassroomObject } from './ClassroomObject'
import { RobotPet } from './RobotPet'

type ClassroomSceneProps = {
  pets: RobotPetData[]
  selectedPetId: string
  problem: EquationProblem
  attempt: PetAttempt | null
  starPosition: { x: number; y: number } | null
  canPetTry: boolean
  onSelectPet: (id: string) => void
  onPetTry: () => void
  onCloseWhiteboard: () => void
  onPlaceStar: (position: { x: number; y: number }) => void
}

const petDeskPositions: Record<string, { x: number; y: number }> = {
  byte: { x: 37.5, y: 51.5 },
  nibi: { x: 62.5, y: 51.5 },
  pippa: { x: 37.5, y: 69.5 },
}

export function ClassroomScene({
  pets,
  selectedPetId,
  problem,
  attempt,
  starPosition,
  canPetTry,
  onSelectPet,
  onPetTry,
  onCloseWhiteboard,
  onPlaceStar,
}: ClassroomSceneProps) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]

  function renderWrittenText(text: string, delayOffset: number) {
    return text.split('').map((character, characterIndex) => (
      <span
        key={`${character}-${characterIndex}`}
        className="whiteboard-character"
        style={{ animationDelay: `${delayOffset + characterIndex * 24}ms` }}
      >
        {character}
      </span>
    ))
  }

  function handleWhiteboardClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    onPlaceStar({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <section className="classroom-shell" aria-label="Algebuds classroom">
      <div className="classroom-scene">
        <div className="back-wall" />
        <ClassroomObject className="chalkboard" label="chalkboard">
          <span>Today: Solve equations</span>
          <small>2x + 4 = 14</small>
        </ClassroomObject>
        <ClassroomObject className="teacher-desk" label="teacher desk">
          <span className="desk-paper" />
          <span className="desk-mug" />
        </ClassroomObject>
        <ClassroomObject className="door" label="classroom door">
          <span />
        </ClassroomObject>
        <ClassroomObject className="bookshelf" label="bookshelf">
          <i />
          <i />
          <i />
        </ClassroomObject>
        <ClassroomObject className="plant plant--left" label="plant" />
        <ClassroomObject className="plant plant--right" label="plant" />
        <ClassroomObject className="rug" label="classroom rug" />
        {[0, 1, 2, 3].map((desk) => (
          <ClassroomObject key={desk} className={`student-desk student-desk--${desk + 1}`} label="student desk">
            <span className="desk-book" />
            <span className="desk-pencil" />
          </ClassroomObject>
        ))}
        <ClassroomObject className="supply-bin" label="supply bin" />
        <ClassroomObject className="clock" label="clock" />
        {canPetTry && (
          <button
            className={`pet-desk-button pet-desk-button--${selectedPet.color}`}
            style={{
              left: `${petDeskPositions[selectedPet.id].x}%`,
              top: `${petDeskPositions[selectedPet.id].y}%`,
            }}
            type="button"
            onClick={onPetTry}
          >
            Let {selectedPet.name} try
          </button>
        )}
        {pets.map((pet) => (
          <RobotPet
            key={pet.id}
            pet={pet}
            selected={pet.id === selectedPetId}
            paused={pet.id === selectedPetId}
            onSelect={onSelectPet}
          />
        ))}
        {attempt && (
          <div className="whiteboard-backdrop">
            <div
              className="whiteboard-popover"
              role="dialog"
              aria-label={`${selectedPet.name}'s whiteboard work`}
              onClick={handleWhiteboardClick}
            >
              <button
                className="whiteboard-close"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onCloseWhiteboard()
                }}
                aria-label="Close whiteboard"
              >
                x
              </button>
              <div className="whiteboard-title">
                <span>{selectedPet.name}'s Whiteboard</span>
                <strong>{problem.prompt}</strong>
              </div>
              <div className="whiteboard-work">
                {attempt.steps.map((step, index) => (
                  <p className={`whiteboard-line whiteboard-line--${step.kind}`} key={`${step.text}-${index}`}>
                    {step.kind === 'equation' ? (
                      <>
                        <span className="equation-left">{renderWrittenText(step.left ?? '', index * 1100)}</span>
                        <span className="equation-equals">{renderWrittenText('=', index * 1100 + 180)}</span>
                        <span className="equation-right">{renderWrittenText(step.right ?? '', index * 1100 + 240)}</span>
                      </>
                    ) : (
                      renderWrittenText(step.text, index * 1100)
                    )}
                  </p>
                ))}
              </div>
              <span className="robot-pencil" aria-hidden="true" />
              {attempt.error && <div className="whiteboard-error">{attempt.error}</div>}
              <div className="whiteboard-hint">Click the work to place one star sticker.</div>
              {starPosition && (
                <span
                  className="star-sticker"
                  style={{ left: `${starPosition.x}%`, top: `${starPosition.y}%` }}
                  aria-label="Star sticker"
                >
                  {'★'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

