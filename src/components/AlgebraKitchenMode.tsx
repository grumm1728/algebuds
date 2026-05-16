import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  boardHasUnresolvedError,
  createInitialKitchenState,
  createKitchenBoard,
  errorLibrary,
  getStation,
  kitchenStations,
  nextBoardStatus,
  pickWrongStation,
  travelTime,
  type AlgebraStep,
  type KitchenBoard,
  type KitchenState,
  type KitchenStation,
  type KitchenStationId,
  type RobotColor,
  type RobotMotion,
  type RobotTrace,
  type RobotWorkflow,
  type StickerType,
} from '../kitchen'

const tickRate = 70
const writingTime = 1220
const errorPauseTime = 8500
const correctionPauseTime = 1300
const traceLifetime = 2600
const waitingBubbleTime = 2400

const robotOffsets: Record<string, { x: number; y: number }> = {
  byte: { x: -3, y: 8 },
  nibi: { x: 4, y: 8 },
  pippa: { x: -1, y: 10 },
}

const waitingOffsets: Record<string, { x: number; y: number }> = {
  byte: { x: -7, y: 10 },
  nibi: { x: 7, y: 10 },
  pippa: { x: 0, y: 13 },
}

const laneOffsets: Record<string, number> = {
  byte: -3,
  nibi: 1,
  pippa: 5,
}

type InspectorSelection =
  | { type: 'robot'; robotId: string }
  | { type: 'solution'; boardId: string | null }
  | null

type StationClaimMap = Map<KitchenStationId, string>

type AdvanceContext = {
  now: number
  stationClaims: StationClaimMap
  boardSequence: number
  blankBoardCount: number
  submittedBoards: KitchenBoard[]
  traces: RobotTrace[]
}

export function AlgebraKitchenMode() {
  const [kitchenState, setKitchenState] = useState(() => createInitialKitchenState())
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [waitingBubble, setWaitingBubble] = useState<{ robotId: string; text: string } | null>(null)

  const selectedRobot = inspectorSelection?.type === 'robot'
    ? kitchenState.robots.find((robot) => robot.id === inspectorSelection.robotId) ?? null
    : null
  const selectedSubmittedBoard = inspectorSelection?.type === 'solution' && inspectorSelection.boardId
    ? kitchenState.submittedBoards.find((board) => board.id === inspectorSelection.boardId) ?? null
    : null
  const selectedBoard = selectedRobot?.board ?? selectedSubmittedBoard
  const selectedColor = selectedRobot?.color ?? (selectedSubmittedBoard
    ? colorForRobotId(selectedSubmittedBoard.robotId)
    : null)
  const heldRobotId = selectedRobot?.board ? selectedRobot.id : null
  const effectiveSelectedStepId = selectedBoard?.steps.some((step) => step.id === selectedStepId)
    ? selectedStepId
    : selectedBoard?.steps.at(-1)?.id ?? null
  const selectedStep = selectedBoard?.steps.find((step) => step.id === effectiveSelectedStepId) ?? null

  useEffect(() => {
    const interval = window.setInterval(() => {
      setKitchenState((currentState) => advanceKitchenState(currentState, Date.now(), heldRobotId))
    }, tickRate)

    return () => window.clearInterval(interval)
  }, [heldRobotId])

  useEffect(() => {
    if (!waitingBubble) return undefined

    const timeout = window.setTimeout(() => setWaitingBubble(null), waitingBubbleTime)
    return () => window.clearTimeout(timeout)
  }, [waitingBubble])

  const activeStuckRobot = useMemo(
    () => kitchenState.robots.find((robot) => robot.status === 'stuck') ?? null,
    [kitchenState.robots],
  )

  function handleStationClick(stationId: KitchenStationId) {
    if (stationId === 'solution') {
      const board = kitchenState.submittedBoards.at(-1) ?? null
      setInspectorSelection({ type: 'solution', boardId: board?.id ?? null })
      setSelectedStepId(board?.steps.at(-1)?.id ?? null)
      return
    }

    const now = Date.now()
    if (kitchenState.robots.some((robot) => robot.status === 'stuck')) {
      setInspectorSelection(null)
      setSelectedStepId(null)
    }

    setKitchenState((currentState) => {
      const stationClaims = buildStationClaims(currentState.robots)
      const stuckRobots = currentState.robots.filter((robot) => robot.status === 'stuck')
      let handled = false

      return {
        ...currentState,
        robots: currentState.robots.map((robot) => {
          if (handled || robot.status !== 'stuck') return robot

          const selectedRobotIsStuck = inspectorSelection?.type === 'robot'
            && robot.id === inspectorSelection.robotId
          const stationMatchesRobot = robot.expectedStationId === stationId
          const onlyStuckRobot = stuckRobots.length === 1 && stuckRobots[0].id === robot.id
          if (!selectedRobotIsStuck && !stationMatchesRobot && !onlyStuckRobot) return robot

          handled = true
          const originalExpectedStationId = robot.expectedStationId
          const isWrongReroute = stationId !== originalExpectedStationId
          releaseRobotClaims(stationClaims, robot.id)

          return routeOrWait(
            {
              ...robot,
              wrongStationId: isWrongReroute ? originalExpectedStationId : undefined,
              message: isWrongReroute
                ? `I will try ${getStation(stationId).label} and see what happens.`
                : 'Thanks. I know where to roll now.',
            },
            stationId,
            stationId,
            {
              now,
              stationClaims,
              boardSequence: currentState.boardSequence,
              blankBoardCount: currentState.blankBoardCount,
              submittedBoards: currentState.submittedBoards,
              traces: currentState.traces,
            },
            isWrongReroute
              ? `Trying ${getStation(stationId).label}, even if it feels suspicious.`
              : 'Rerouting with a fresh little beep.',
          )
        }),
      }
    })
  }

  function handleSticker(sticker: StickerType) {
    if (!inspectorSelection) return

    const now = Date.now()

    if (inspectorSelection.type === 'solution') {
      if (!inspectorSelection.boardId || !effectiveSelectedStepId || sticker === 'reroute') return

      setKitchenState((currentState) => ({
        ...currentState,
        submittedBoards: currentState.submittedBoards.map((board) => {
          if (board.id !== inspectorSelection.boardId) return board

          const steps = applyStepSticker(board.steps, effectiveSelectedStepId, sticker).steps
          const nextBoard = {
            ...board,
            steps,
          }

          return {
            ...nextBoard,
            status: nextBoardStatus(nextBoard),
          }
        }),
      }))
      return
    }

    setKitchenState((currentState) => ({
      ...currentState,
      robots: currentState.robots.map((robot) => {
        if (robot.id !== inspectorSelection.robotId || !robot.board) return robot

        if (sticker === 'reroute') {
          if (robot.status !== 'stuck') {
            return {
              ...robot,
              message: 'Reroute sticker saved for the next wrong-station moment.',
            }
          }

          return {
            ...robot,
            message: `Reroute sticker placed. I need ${getStation(robot.expectedStationId).label}.`,
          }
        }

        if (!effectiveSelectedStepId) return robot

        const { steps, correctedError } = applyStepSticker(robot.board.steps, effectiveSelectedStepId, sticker)

        const board = {
          ...robot.board,
          steps,
        }

        return {
          ...robot,
          board,
          status: correctedError && robot.status === 'awaiting_feedback' ? 'awaiting_feedback' : robot.status,
          availableAt: correctedError && robot.status === 'awaiting_feedback'
            ? now + correctionPauseTime
            : robot.availableAt,
          message: correctedError
            ? 'Thanks. I crossed that out and wrote the repaired line.'
            : sticker === 'star'
              ? 'Star saved. My confidence battery is warmer.'
              : 'Thanks for checking that line.',
        }
      }),
    }))
  }

  return (
    <>
      <section className="kitchen-shell" aria-label="Algebra Kitchen">
        <div className="kitchen-scene">
          <div className="kitchen-back-wall">
            <div className="kitchen-chalkboard">
              <span>Today: Algebra Kitchen</span>
              <strong>Keep the steps moving</strong>
            </div>
            <span className="kitchen-clock" aria-hidden="true" />
          </div>

          {kitchenState.traces.map((trace) => (
            <span
              className={`robot-trace robot-trace--${trace.color}`}
              key={trace.id}
              style={{ left: `${trace.x}%`, top: `${trace.y}%` }}
              aria-hidden="true"
            />
          ))}

          {kitchenStations.map((station) => (
            <KitchenStationButton
              key={station.id}
              station={station}
              blankBoardCount={kitchenState.blankBoardCount}
              targeted={kitchenState.robots.some((robot) => robot.targetStationId === station.id)}
              submittedBoardCount={kitchenState.submittedBoards.length}
              stuckTarget={activeStuckRobot?.expectedStationId === station.id}
              onClick={handleStationClick}
            />
          ))}

          {kitchenState.robots.map((robot) => (
            <RobotWorker
              key={robot.id}
              robot={robot}
              selected={inspectorSelection?.type === 'robot' && robot.id === inspectorSelection.robotId}
              held={heldRobotId === robot.id}
              onSelect={(robotId) => {
                const clickedRobot = kitchenState.robots.find((item) => item.id === robotId)
                if (!clickedRobot) return

                if (clickedRobot.status === 'waiting') {
                  setWaitingBubble({
                    robotId,
                    text: waitingForMessage(clickedRobot, kitchenState.robots),
                  })
                  return
                }

                setWaitingBubble(null)
                setInspectorSelection({ type: 'robot', robotId })
                const board = clickedRobot.board
                setSelectedStepId(board?.steps.at(-1)?.id ?? null)
              }}
              waitingBubbleText={waitingBubble?.robotId === robot.id ? waitingBubble.text : null}
            />
          ))}
        </div>
      </section>

      <WhiteboardInspector
        robot={selectedRobot}
        board={selectedBoard ?? null}
        color={selectedColor}
        selectedStep={selectedStep}
        selectedStepId={effectiveSelectedStepId}
        isSolutionArchive={inspectorSelection?.type === 'solution'}
        submittedBoards={kitchenState.submittedBoards}
        selectedSubmittedBoardId={inspectorSelection?.type === 'solution' ? inspectorSelection.boardId : null}
        onSelectSubmittedBoard={(boardId) => {
          const board = kitchenState.submittedBoards.find((item) => item.id === boardId)
          setInspectorSelection({ type: 'solution', boardId })
          setSelectedStepId(board?.steps.at(-1)?.id ?? null)
        }}
        onSelectStep={setSelectedStepId}
        onSticker={handleSticker}
        onCloseBoard={() => {
          setInspectorSelection(null)
          setSelectedStepId(null)
        }}
      />
    </>
  )
}

function KitchenStationButton({
  station,
  blankBoardCount,
  submittedBoardCount,
  targeted,
  stuckTarget,
  onClick,
}: {
  station: KitchenStation
  blankBoardCount: number
  submittedBoardCount: number
  targeted: boolean
  stuckTarget: boolean
  onClick: (stationId: KitchenStationId) => void
}) {
  return (
    <button
      className={[
        'kitchen-station',
        `kitchen-station--${station.tone}`,
        `kitchen-station--${station.prop}`,
        targeted ? 'is-targeted' : '',
        stuckTarget ? 'is-stuck-target' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: `${station.x}%`, top: `${station.y}%` }}
      type="button"
      data-station-id={station.id}
      onClick={() => onClick(station.id)}
    >
      <span className="station-sign">
        <strong>{station.label}</strong>
        <small>{station.helper}</small>
      </span>
      <span className="station-counter">
        {station.id === 'start' && (
          <span className="blank-board-stack" aria-label={`${blankBoardCount} blank whiteboards`}>
            {Array.from({ length: Math.min(blankBoardCount, 6) }).map((_, index) => (
              <i key={index} style={{ '--stack-index': index } as CSSProperties} />
            ))}
          </span>
        )}
        {station.id === 'solution' && (
          <span className="solution-board-stack" aria-label={`${submittedBoardCount} submitted whiteboards`}>
            {Array.from({ length: Math.min(submittedBoardCount, 7) }).map((_, index) => (
              <i key={index} style={{ '--stack-index': index } as CSSProperties} />
            ))}
          </span>
        )}
        <i />
        <b />
      </span>
    </button>
  )
}

function RobotWorker({
  robot,
  selected,
  held,
  onSelect,
  waitingBubbleText,
}: {
  robot: RobotWorkflow
  selected: boolean
  held: boolean
  onSelect: (robotId: string) => void
  waitingBubbleText: string | null
}) {
  const lastSteps = robot.board?.steps.slice(-3) ?? []
  const facing = robot.targetStationId === robot.currentStationId ? 'right' : 'left'
  const waitStage = waitingStage(robot)
  const glyph = statusGlyph(robot.status, waitStage)

  return (
    <button
      className={`robot-pet kitchen-worker robot-pet--${robot.color} ${selected ? 'is-selected' : ''}`}
      style={{
        left: `${robot.position.x}%`,
        top: `${robot.position.y}%`,
        '--travel-ms': `${robot.travelMs}ms`,
      } as CSSProperties}
      type="button"
      onClick={() => onSelect(robot.id)}
      aria-label={`Inspect ${robot.name}'s kitchen board`}
      data-facing={facing}
      data-status={robot.status}
      data-target-station={robot.targetStationId}
      data-current-station={robot.currentStationId ?? ''}
      data-wait-stage={waitStage}
      data-held={held ? 'true' : 'false'}
    >
      {waitingBubbleText && <span className="robot-wait-bubble">{waitingBubbleText}</span>}
      {glyph && <span className="robot-indicator">{glyph}</span>}
      <span className="pet-antenna" />
      <span className="pet-head">
        <span className="pet-eye pet-eye--left" />
        <span className="pet-eye pet-eye--right" />
        <span className="pet-mouth" />
      </span>
      <span className="pet-body">
        <span className="pet-panel" />
      </span>
      {robot.board && (
        <span className="mini-board" aria-hidden="true">
          <strong>{robot.board.equation}</strong>
          {lastSteps.length === 0 ? (
            <span className="mini-board-blank" />
          ) : lastSteps.map((step) => (
            <span
              className={`mini-board-line ${step.isError && !step.wasCorrected ? 'has-error' : ''}`}
              key={step.id}
            >
              {step.wasCorrected ? step.correctedExpression : step.expression}
            </span>
          ))}
        </span>
      )}
      <span className="pet-shadow" />
    </button>
  )
}

function WhiteboardInspector({
  robot,
  board,
  color,
  selectedStep,
  selectedStepId,
  isSolutionArchive,
  submittedBoards,
  selectedSubmittedBoardId,
  onSelectSubmittedBoard,
  onSelectStep,
  onSticker,
  onCloseBoard,
}: {
  robot: RobotWorkflow | null
  board: KitchenBoard | null
  color: RobotColor | null
  selectedStep: AlgebraStep | null
  selectedStepId: string | null
  isSolutionArchive: boolean
  submittedBoards: KitchenBoard[]
  selectedSubmittedBoardId: string | null
  onSelectSubmittedBoard: (boardId: string) => void
  onSelectStep: (stepId: string) => void
  onSticker: (sticker: StickerType) => void
  onCloseBoard: () => void
}) {
  const canMarkStep = Boolean(selectedStepId)
  const canReroute = robot?.status === 'stuck' && !isSolutionArchive

  if (!board) {
    return (
      <aside className="kitchen-inspector" aria-label="Kitchen whiteboard inspector">
        <section className={`panel-card kitchen-empty-state ${color ? `inspector-card--${color}` : ''}`}>
          <p className="eyebrow">{isSolutionArchive ? 'Solution Box Archive' : 'Whiteboard Inspector'}</p>
          <h2>{isSolutionArchive ? 'No submitted boards yet' : 'No board selected'}</h2>
          <p>
            {isSolutionArchive
              ? 'Submitted work will collect here as the box fills.'
              : robot
                ? `${robot.name} is heading for a blank board.`
                : 'Select a robot or the Solution Box.'}
          </p>
          {isSolutionArchive && (
            <SubmittedBoardPicker
              boards={submittedBoards}
              selectedBoardId={selectedSubmittedBoardId}
              onSelect={onSelectSubmittedBoard}
            />
          )}
        </section>
      </aside>
    )
  }

  return (
    <aside className="kitchen-inspector" aria-label={`${robot?.name ?? 'Submitted'} kitchen whiteboard`}>
      <section className={`panel-card inspector-card inspector-card--${color ?? 'blue'}`}>
        <div className="inspector-heading">
          <div>
            <p className="eyebrow">{isSolutionArchive ? 'Solution Box Archive' : `${robot?.name}'s Whiteboard`}</p>
            <h2>{board.equation}</h2>
          </div>
          <div className="inspector-actions">
            <StatusPill board={board} robot={robot} isSolutionArchive={isSolutionArchive} />
            <button
              className="inspector-close"
              type="button"
              onClick={onCloseBoard}
              aria-label="Close whiteboard inspector"
            >
              Close
            </button>
          </div>
        </div>

        {isSolutionArchive && (
          <SubmittedBoardPicker
            boards={submittedBoards}
            selectedBoardId={selectedSubmittedBoardId}
            onSelect={onSelectSubmittedBoard}
          />
        )}

        <div className="inspector-board">
          {board.steps.length === 0 ? (
            <div className="inspector-board-empty">Fresh board</div>
          ) : board.steps.map((step, index) => (
            <button
              className={[
                'inspector-line',
                selectedStepId === step.id ? 'is-selected' : '',
                step.isError ? 'has-error' : '',
                step.wasCorrected ? 'was-corrected' : '',
              ].filter(Boolean).join(' ')}
              key={step.id}
              type="button"
              onClick={() => onSelectStep(step.id)}
            >
              <span className="line-number">{index + 1}</span>
              <span className="line-expression">{step.expression}</span>
              {step.feedbackSticker && <span className="line-sticker">{stickerLabel(step.feedbackSticker)}</span>}
              {step.wasCorrected && step.correctedExpression && (
                <span className="line-correction">{step.correctedExpression}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sticker-tray" aria-label="Feedback stickers">
          <button type="button" disabled={!canMarkStep} onClick={() => onSticker('star')}>
            Star
          </button>
          <button type="button" disabled={!canMarkStep} onClick={() => onSticker('check_this')}>
            Check This
          </button>
          <button type="button" disabled={!canReroute} onClick={() => onSticker('reroute')}>
            Reroute
          </button>
        </div>

        <div className="inspector-note" aria-live="polite">
          {selectedStep?.isError && !selectedStep.wasCorrected
            ? errorLibrary[selectedStep.errorType ?? 'bad_arithmetic']
            : isSolutionArchive
              ? submittedMessage(board)
              : robot?.message}
        </div>
      </section>
    </aside>
  )
}

function SubmittedBoardPicker({
  boards,
  selectedBoardId,
  onSelect,
}: {
  boards: KitchenBoard[]
  selectedBoardId: string | null
  onSelect: (boardId: string) => void
}) {
  const recentBoards = [...boards].reverse()

  return (
    <div className="submitted-picker" aria-label="Submitted boards">
      {recentBoards.map((board) => (
        <button
          className={[
            'submitted-picker-card',
            `submitted-picker-card--${board.status}`,
            selectedBoardId === board.id ? 'is-selected' : '',
          ].filter(Boolean).join(' ')}
          key={board.id}
          type="button"
          onClick={() => onSelect(board.id)}
        >
          <strong>{board.equation}</strong>
          <span>{board.status === 'complete' ? 'Complete' : 'Needs review'}</span>
        </button>
      ))}
    </div>
  )
}

function StatusPill({
  board,
  robot,
  isSolutionArchive,
}: {
  board: KitchenBoard
  robot: RobotWorkflow | null
  isSolutionArchive: boolean
}) {
  const label = isSolutionArchive
    ? board.status === 'complete' ? 'Complete' : 'Needs review'
    : robot?.status === 'stuck'
      ? 'Question'
      : boardHasUnresolvedError(board)
        ? 'Needs eyes'
        : robot?.status === 'submitting'
          ? 'Submitting'
          : 'Working'

  return <span className={`status-pill status-pill--${robot?.status ?? board.status}`}>{label}</span>
}

function advanceKitchenState(currentState: KitchenState, now: number, heldRobotId: string | null): KitchenState {
  const context: AdvanceContext = {
    now,
    stationClaims: buildStationClaims(currentState.robots),
    boardSequence: currentState.boardSequence,
    blankBoardCount: currentState.blankBoardCount,
    submittedBoards: [...currentState.submittedBoards],
    traces: currentState.traces.filter((trace) => now - trace.createdAt < traceLifetime),
  }

  const shouldRefillBoards = now >= currentState.nextBoardRefillAt || context.blankBoardCount <= 1
  if (shouldRefillBoards) {
    context.blankBoardCount = Math.min(8, context.blankBoardCount + randomInt(3, 5))
  }

  const nextBoardRefillAt = shouldRefillBoards
    ? now + randomInt(12000, 18000)
    : currentState.nextBoardRefillAt

  const robots = currentState.robots.map((robot) => {
    const nextRobot = heldRobotId === robot.id
      ? holdRobot(robot, now)
      : advanceRobot(robot, context)

    if (positionChanged(robot.position, nextRobot.position)) {
      context.traces.push({
        id: `${robot.id}-${now}-${context.traces.length}`,
        robotId: robot.id,
        color: robot.color,
        x: robot.position.x,
        y: robot.position.y,
        createdAt: now,
      })
    }

    return nextRobot
  })

  return {
    robots,
    submittedBoards: context.submittedBoards,
    boardSequence: context.boardSequence,
    blankBoardCount: context.blankBoardCount,
    nextBoardRefillAt,
    traces: context.traces.slice(-36),
  }
}

function advanceRobot(robot: RobotWorkflow, context: AdvanceContext): RobotWorkflow {
  const robotAfterMotion = robot.motion ? advanceMotion(robot, context.now) : robot
  if (robotAfterMotion.motion) return robotAfterMotion
  robot = robotAfterMotion

  if (robot.status === 'waiting') {
    if (context.now < robot.availableAt) return robot

    return routeOrWait(robot, robot.targetStationId, robot.expectedStationId, context, robot.message)
  }

  if (context.now < robot.availableAt) return robot

  if (robot.status === 'moving') {
    return handleStationArrival(robot, context)
  }

  if (robot.status === 'writing') {
    if (!robot.board) return routeOrWait(robot, 'start', 'start', context, 'Heading for a blank board.')

    if (robot.wrongStationId) {
      const wrongStep = createWrongStationStep(robot, context.now)
      const board = wrongStep
        ? {
            ...robot.board,
            steps: [...robot.board.steps, wrongStep],
          }
        : robot.board

      return {
        ...robot,
        board,
        status: 'stuck',
        targetStationId: robot.currentStationId ?? robot.targetStationId,
        expectedStationId: robot.wrongStationId,
        wrongStationId: undefined,
        availableAt: context.now + errorPauseTime,
        waitStartedAt: context.now,
        message: `That ${getStation(robot.currentStationId ?? robot.targetStationId).label} try did not unlock it. Can you point me again?`,
      }
    }

    const nextStep = robot.board.plan[robot.board.nextStepIndex]
    if (!nextStep) {
      return routeToNextStep(robot, context)
    }

    const board = {
      ...robot.board,
      steps: [...robot.board.steps, nextStep],
      nextStepIndex: robot.board.nextStepIndex + 1,
    }

    const robotWithStep = {
      ...robot,
      board,
      message: nextStep.isError ? 'This line might need teacher eyes.' : 'Line added. Rolling to the next station.',
    }

    if (nextStep.isError) {
      return {
        ...robotWithStep,
        status: 'awaiting_feedback',
        availableAt: context.now + errorPauseTime,
      }
    }

    return routeToNextStep(robotWithStep, context)
  }

  if (robot.status === 'awaiting_feedback') {
    return routeToNextStep(
      {
        ...robot,
        message: robot.board && boardHasUnresolvedError(robot.board)
          ? 'I will keep this line for review and keep moving.'
          : 'Correction accepted. Back to the kitchen path.',
      },
      context,
    )
  }

  if (robot.status === 'submitting' && robot.board) {
    context.submittedBoards.push({
      ...robot.board,
      status: nextBoardStatus(robot.board),
    })

    return routeOrWait(
      {
        ...robot,
        board: null,
        cycle: robot.cycle + 1,
        shouldForceStuck: context.boardSequence % 4 === 2 || Math.random() < 0.2,
        hasForcedStuck: false,
        message: 'Heading back for a fresh blank board.',
      },
      'start',
      'start',
      context,
      'Heading back for a fresh blank board.',
    )
  }

  return robot
}

function handleStationArrival(robot: RobotWorkflow, context: AdvanceContext): RobotWorkflow {
  if (robot.targetStationId !== robot.expectedStationId) {
    return {
      ...robot,
      currentStationId: robot.targetStationId,
      status: 'stuck',
      waitStartedAt: context.now,
      message: 'This counter feels wrong. Can you tap the station I need?',
    }
  }

  if (robot.targetStationId === 'start' && !robot.board) {
    if (context.blankBoardCount <= 0) {
      releaseRobotClaims(context.stationClaims, robot.id)
      return waitNearStation(robot, 'start', 'start', context.now, 'Waiting for blank boards to be restocked.')
    }

    const board = createKitchenBoard(context.boardSequence, robot.id, robot.forceNextError)
    context.boardSequence += 1
    context.blankBoardCount -= 1

    return {
      ...robot,
      board,
      currentStationId: 'start',
      status: 'writing',
      availableAt: context.now + writingTime,
      forceNextError: false,
      message: 'Blank board grabbed. Writing the equation now.',
    }
  }

  if (robot.targetStationId === 'solution' && robot.board) {
    return {
      ...robot,
      currentStationId: robot.targetStationId,
      status: 'submitting',
      availableAt: context.now + 900,
      message: 'Dropping this board into the Solution Box.',
    }
  }

  if (!robot.board) {
    return routeOrWait(robot, 'start', 'start', context, 'Heading for a blank board.')
  }

  if (robot.wrongStationId) {
    return {
      ...robot,
      currentStationId: robot.targetStationId,
      status: 'writing',
      availableAt: context.now + writingTime,
      message: `Trying ${getStation(robot.targetStationId).label} as best I can.`,
    }
  }

  return {
    ...robot,
    currentStationId: robot.targetStationId,
    status: 'writing',
    availableAt: context.now + writingTime,
    message: `Writing at ${getStation(robot.targetStationId).label}.`,
  }
}

function routeToNextStep(robot: RobotWorkflow, context: AdvanceContext): RobotWorkflow {
  if (!robot.board) {
    return routeOrWait(robot, 'start', 'start', context, 'Heading for a blank board.')
  }

  const nextStep = robot.board.plan[robot.board.nextStepIndex]
  if (!nextStep) {
    return routeOrWait(robot, 'solution', 'solution', context, 'Heading to the Solution Box.')
  }

  const expectedStationId = nextStep.stationId
  const shouldTakeWrongStation = robot.shouldForceStuck
    && !robot.hasForcedStuck
    && expectedStationId !== 'start'
  const targetStationId = shouldTakeWrongStation
    ? pickWrongStation(expectedStationId, `${robot.id}-${robot.board.id}`)
    : expectedStationId

  return routeOrWait(
    {
      ...robot,
      hasForcedStuck: shouldTakeWrongStation ? true : robot.hasForcedStuck,
      wrongStationId: shouldTakeWrongStation ? targetStationId : undefined,
    },
    targetStationId,
    expectedStationId,
    context,
    shouldTakeWrongStation
      ? 'Trying a station that might be wrong.'
      : `Rolling to ${getStation(expectedStationId).label}.`,
  )
}

function routeOrWait(
  robot: RobotWorkflow,
  stationId: KitchenStationId,
  expectedStationId: KitchenStationId,
  context: AdvanceContext,
  message: string,
): RobotWorkflow {
  releaseRobotClaims(context.stationClaims, robot.id)

  if (stationIsFree(context.stationClaims, stationId, robot.id)) {
    context.stationClaims.set(stationId, robot.id)
    return moveToStation(robot, stationId, expectedStationId, context.now, message)
  }

  return waitNearStation(robot, stationId, expectedStationId, context.now, message)
}

function moveToStation(
  robot: RobotWorkflow,
  stationId: KitchenStationId,
  expectedStationId: KitchenStationId,
  now: number,
  message: string,
): RobotWorkflow {
  const motion = buildMotion(robot.position, stationPosition(stationId, robot.id), robot.id, now)

  return {
    ...robot,
    targetStationId: stationId,
    expectedStationId,
    status: 'moving',
    currentStationId: undefined,
    waitStartedAt: undefined,
    motion,
    availableAt: now + motion.durationMs,
    travelMs: motion.durationMs,
    message,
  }
}

function waitNearStation(
  robot: RobotWorkflow,
  stationId: KitchenStationId,
  expectedStationId: KitchenStationId,
  now: number,
  message: string,
): RobotWorkflow {
  const motion = buildMotion(robot.position, waitingPosition(stationId, robot.id), robot.id, now)
  const waitingRobot: RobotWorkflow = {
    ...robot,
    targetStationId: stationId,
    expectedStationId,
    currentStationId: undefined,
    status: 'waiting',
    motion,
    availableAt: now + motion.durationMs,
    travelMs: motion.durationMs,
    waitStartedAt: robot.status === 'waiting' ? robot.waitStartedAt ?? now : now,
    message,
  }

  return waitingRobot
}

function holdRobot(robot: RobotWorkflow, now: number): RobotWorkflow {
  return {
    ...robot,
    motion: robot.motion
      ? { ...robot.motion, startedAt: robot.motion.startedAt + tickRate }
      : undefined,
    availableAt: Math.max(robot.availableAt, now + tickRate),
    travelMs: 0,
    message: 'Board is open for review.',
  }
}

function buildStationClaims(robots: RobotWorkflow[]): StationClaimMap {
  const claims: StationClaimMap = new Map()

  robots.forEach((robot) => {
    if (robot.status === 'waiting') return

    if (robot.status === 'moving') {
      claims.set(robot.targetStationId, robot.id)
      return
    }

    const stationId = robot.currentStationId ?? robot.targetStationId
    claims.set(stationId, robot.id)
  })

  return claims
}

function releaseRobotClaims(claims: StationClaimMap, robotId: string) {
  Array.from(claims.entries()).forEach(([stationId, ownerId]) => {
    if (ownerId === robotId) claims.delete(stationId)
  })
}

function stationIsFree(claims: StationClaimMap, stationId: KitchenStationId, robotId: string) {
  const owner = claims.get(stationId)
  return owner === undefined || owner === robotId
}

function waitingForMessage(robot: RobotWorkflow, robots: RobotWorkflow[]) {
  const owner = robots.find((candidate) => (
    candidate.id !== robot.id
    && candidate.status !== 'waiting'
    && (candidate.currentStationId === robot.targetStationId || candidate.targetStationId === robot.targetStationId)
  ))

  return owner
    ? `Waiting for ${owner.name}`
    : `Waiting for ${getStation(robot.targetStationId).label}`
}

function buildMotion(
  from: { x: number; y: number },
  to: { x: number; y: number },
  robotId: string,
  startedAt: number,
): RobotMotion {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  if (distance < 2) {
    return {
      start: from,
      control1: from,
      control2: to,
      end: to,
      startedAt,
      durationMs: 80,
    }
  }

  const isMeandering = distance > 16 && Math.random() < 0.1
  const laneY = clamp(51 + (laneOffsets[robotId] ?? 0) + randomBetween(-8, 8), 38, 64)
  const normal = {
    x: -(to.y - from.y) / distance,
    y: (to.x - from.x) / distance,
  }
  const firstBendDirection = Math.random() < 0.5 ? -1 : 1
  const secondBendDirection = isMeandering
    ? firstBendDirection * -1
    : firstBendDirection * randomBetween(0.72, 1.24)
  const bendAmount = clamp(
    distance * randomBetween(isMeandering ? 0.48 : 0.18, isMeandering ? 0.86 : 0.5),
    isMeandering ? 18 : 7,
    isMeandering ? 45 : 28,
  )
  const laneBias = laneY - (from.y + to.y) / 2
  const meanderPush = isMeandering ? randomBetween(-10, 10) : randomBetween(-4, 4)
  const control1 = {
    x: from.x + (to.x - from.x) * randomBetween(isMeandering ? 0.14 : 0.2, isMeandering ? 0.42 : 0.38)
      + normal.x * bendAmount * firstBendDirection
      + meanderPush
      + randomBetween(-5, 5),
    y: from.y + (to.y - from.y) * randomBetween(isMeandering ? 0.12 : 0.18, isMeandering ? 0.42 : 0.36)
      + normal.y * bendAmount * firstBendDirection
      + laneBias * randomBetween(isMeandering ? 0.44 : 0.2, isMeandering ? 0.78 : 0.54)
      + randomBetween(-5, 5),
  }
  const control2 = {
    x: from.x + (to.x - from.x) * randomBetween(isMeandering ? 0.58 : 0.62, isMeandering ? 0.9 : 0.8)
      + normal.x * bendAmount * secondBendDirection
      - meanderPush
      + randomBetween(-5, 5),
    y: from.y + (to.y - from.y) * randomBetween(isMeandering ? 0.58 : 0.64, isMeandering ? 0.92 : 0.84)
      + normal.y * bendAmount * secondBendDirection
      + laneBias * randomBetween(isMeandering ? 0.42 : 0.24, isMeandering ? 0.82 : 0.58)
      + randomBetween(-5, 5),
  }

  return {
    start: from,
    control1: clampPoint(control1),
    control2: clampPoint(control2),
    end: to,
    startedAt,
    durationMs: Math.round(travelTime(from, to) * (isMeandering ? randomBetween(1.28, 1.55) : randomBetween(0.94, 1.08))),
  }
}

function advanceMotion(robot: RobotWorkflow, now: number): RobotWorkflow {
  if (!robot.motion) return robot

  const rawProgress = clamp((now - robot.motion.startedAt) / robot.motion.durationMs, 0, 1)
  const easedProgress = smootherStep(rawProgress)
  const position = cubicBezierPoint(robot.motion, easedProgress)

  if (rawProgress >= 1) {
    return {
      ...robot,
      position: robot.motion.end,
      motion: undefined,
      availableAt: now,
      travelMs: 0,
    }
  }

  return {
    ...robot,
    position,
  }
}

function cubicBezierPoint(motion: RobotMotion, t: number) {
  const oneMinusT = 1 - t
  const oneMinusTSquared = oneMinusT * oneMinusT
  const tSquared = t * t

  return {
    x: oneMinusTSquared * oneMinusT * motion.start.x
      + 3 * oneMinusTSquared * t * motion.control1.x
      + 3 * oneMinusT * tSquared * motion.control2.x
      + tSquared * t * motion.end.x,
    y: oneMinusTSquared * oneMinusT * motion.start.y
      + 3 * oneMinusTSquared * t * motion.control1.y
      + 3 * oneMinusT * tSquared * motion.control2.y
      + tSquared * t * motion.end.y,
  }
}

function smootherStep(value: number) {
  return value * value * value * (value * (value * 6 - 15) + 10)
}

function stationPosition(stationId: KitchenStationId, robotId: string) {
  const station = getStation(stationId)
  const offset = robotOffsets[robotId] ?? { x: 0, y: 8 }

  return {
    x: clamp(station.x + offset.x, 9, 91),
    y: clamp(station.y + offset.y, 22, 84),
  }
}

function waitingPosition(stationId: KitchenStationId, robotId: string) {
  const station = getStation(stationId)
  const offset = waitingOffsets[robotId] ?? { x: 0, y: 20 }

  return {
    x: clamp(station.x + offset.x, 9, 91),
    y: clamp(station.y + offset.y, 24, 84),
  }
}

function waitingStage(robot: RobotWorkflow) {
  if ((robot.status !== 'waiting' && robot.status !== 'stuck') || !robot.waitStartedAt) return 0

  const elapsed = Date.now() - robot.waitStartedAt
  if (elapsed >= 15000) return 3
  if (elapsed >= 10000) return 2
  if (elapsed >= 5000) return 1
  return 0
}

function statusGlyph(status: RobotWorkflow['status'], waitStage: number) {
  if (status === 'stuck') return '?'
  if (status === 'awaiting_feedback') return '!'
  if (status === 'waiting' && waitStage > 0) return '...'
  if (status === 'submitting') return '+'
  return ''
}

function createWrongStationStep(robot: RobotWorkflow, now: number): AlgebraStep | null {
  if (!robot.board || !robot.wrongStationId) return null

  const stationId = robot.currentStationId ?? robot.targetStationId
  const operation = operationForStation(stationId)
  const errorType = errorTypeForStation(stationId)
  const nextStep = robot.board.plan[robot.board.nextStepIndex]
  if (!operation || !errorType || !nextStep) return null

  return {
    id: `${robot.board.id}-wrong-${stationId}-${now}`,
    expression: wrongStationExpression(stationId, robot.board),
    operation,
    stationId,
    isError: true,
    errorType,
    correctedExpression: nextStep.expression,
  }
}

function operationForStation(stationId: KitchenStationId): AlgebraStep['operation'] | null {
  if (stationId === 'distribute') return 'distribute'
  if (stationId === 'combine') return 'combine_like_terms'
  if (stationId === 'add_subtract') return 'add_subtract'
  if (stationId === 'multiply_divide') return 'multiply_divide'
  if (stationId === 'simplify') return 'simplify'
  if (stationId === 'check') return 'check'
  return null
}

function errorTypeForStation(stationId: KitchenStationId): AlgebraStep['errorType'] | null {
  if (stationId === 'distribute') return 'forget_to_distribute'
  if (stationId === 'combine') return 'combine_unlike_terms'
  if (stationId === 'add_subtract') return 'sign_swap_subtract'
  if (stationId === 'multiply_divide') return 'divide_one_side_only'
  if (stationId === 'simplify') return 'bad_arithmetic'
  if (stationId === 'check') return 'bad_arithmetic'
  return null
}

function wrongStationExpression(stationId: KitchenStationId, board: KitchenBoard) {
  const latestExpression = board.steps.at(-1)?.correctedExpression
    ?? board.steps.at(-1)?.expression
    ?? board.equation

  if (stationId === 'distribute') return `Tried distribute: ${latestExpression}`
  if (stationId === 'combine') return `Tried combine: ${latestExpression}`
  if (stationId === 'add_subtract') return `Tried a both-sides move: ${latestExpression}`
  if (stationId === 'multiply_divide') return `Tried divide/multiply: ${latestExpression}`
  if (stationId === 'simplify') return `Tried simplify: ${latestExpression}`
  if (stationId === 'check') return `Tried check too early: ${latestExpression}`
  return `Tried ${getStation(stationId).label}: ${latestExpression}`
}

function applyStepSticker(steps: AlgebraStep[], stepId: string, sticker: StickerType) {
  let correctedError = false
  const nextSteps = steps.map((step) => {
    if (step.id !== stepId) return step

    if (sticker === 'star') {
      return {
        ...step,
        feedbackSticker: sticker,
      }
    }

    correctedError = Boolean(step.isError && !step.wasCorrected)
    return {
      ...step,
      feedbackSticker: sticker,
      wasFlagged: true,
      wasCorrected: step.isError ? true : step.wasCorrected,
    }
  })

  return {
    correctedError,
    steps: nextSteps,
  }
}

function colorForRobotId(robotId: string): RobotColor {
  if (robotId === 'nibi') return 'yellow'
  if (robotId === 'pippa') return 'pink'
  if (robotId === 'byte') return 'blue'
  return 'green'
}

function submittedMessage(board: KitchenBoard) {
  return board.status === 'complete'
    ? 'This board is complete in the Solution Box.'
    : 'This board was submitted with unresolved work to review.'
}

function stickerLabel(sticker: StickerType) {
  if (sticker === 'check_this') return 'Check'
  if (sticker === 'reroute') return 'Route'
  return 'Star'
}

function positionChanged(
  previous: { x: number; y: number },
  next: { x: number; y: number },
) {
  return Math.hypot(next.x - previous.x, next.y - previous.y) > 0.18
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clampPoint(point: { x: number; y: number }) {
  return {
    x: clamp(point.x, 8, 92),
    y: clamp(point.y, 20, 84),
  }
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}
