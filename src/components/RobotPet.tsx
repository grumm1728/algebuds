import { useEffect, useState } from 'react'
import type { RobotPetData } from '../types'

type RobotPetProps = {
  pet: RobotPetData
  selected: boolean
  paused: boolean
  onSelect: (id: string) => void
}

const emotes = ['?', '!', '+', 'x']

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function RobotPet({ pet, selected, paused, onSelect }: RobotPetProps) {
  const [position, setPosition] = useState(pet.start)
  const [facing, setFacing] = useState<'left' | 'right'>('right')
  const [emote, setEmote] = useState('')

  const [speed] = useState(() => 2400 + Math.random() * 1200)

  useEffect(() => {
    if (paused) return undefined

    const interval = window.setInterval(() => {
      setPosition((current) => {
        const next = {
          x: clamp(current.x + (Math.random() - 0.5) * 12, 10, 86),
          y: clamp(current.y + (Math.random() - 0.5) * 10, 34, 78),
        }
        setFacing(next.x >= current.x ? 'right' : 'left')
        return next
      })

      if (Math.random() > 0.62) {
        setEmote(emotes[Math.floor(Math.random() * emotes.length)])
        window.setTimeout(() => setEmote(''), 1100)
      }
    }, speed)

    return () => window.clearInterval(interval)
  }, [paused, speed])

  return (
    <button
      className={`robot-pet robot-pet--${pet.color} ${selected ? 'is-selected' : ''}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      type="button"
      onClick={() => onSelect(pet.id)}
      aria-label={`Select ${pet.name}`}
      data-facing={facing}
    >
      {emote && <span className="pet-emote">{emote}</span>}
      <span className="pet-antenna" />
      <span className="pet-head">
        <span className="pet-eye pet-eye--left" />
        <span className="pet-eye pet-eye--right" />
        <span className="pet-mouth" />
      </span>
      <span className="pet-body">
        <span className="pet-panel" />
      </span>
      <span className="pet-shadow" />
    </button>
  )
}
