export type KitchenStationId =
  | 'start'
  | 'distribute'
  | 'combine'
  | 'add_subtract'
  | 'multiply_divide'
  | 'simplify'
  | 'check'
  | 'solution'

export type AlgebraOperation =
  | 'distribute'
  | 'combine_like_terms'
  | 'add_subtract'
  | 'multiply_divide'
  | 'simplify'
  | 'check'

export type ErrorType =
  | 'sign_swap_subtract'
  | 'divide_one_side_only'
  | 'forget_to_distribute'
  | 'combine_unlike_terms'
  | 'drop_negative'
  | 'bad_arithmetic'

export type StickerType = 'star' | 'check_this' | 'reroute'

export type BoardStatus = 'working' | 'complete' | 'needs_review'

export type RobotWorkflowStatus =
  | 'moving'
  | 'waiting'
  | 'writing'
  | 'awaiting_feedback'
  | 'stuck'
  | 'submitting'
  | 'celebrating'

export type AlgebraStep = {
  id: string
  expression: string
  operation: AlgebraOperation
  stationId: KitchenStationId
  isError?: boolean
  errorType?: ErrorType
  correctedExpression?: string
  wasFlagged?: boolean
  wasCorrected?: boolean
  feedbackSticker?: StickerType
}

export type StepPlan = AlgebraStep

export type KitchenBoard = {
  id: string
  templateId: string
  robotId: string
  equation: string
  plan: StepPlan[]
  steps: AlgebraStep[]
  nextStepIndex: number
  status: BoardStatus
}

export type KitchenStation = {
  id: KitchenStationId
  label: string
  helper: string
  x: number
  y: number
  tone: 'mint' | 'gold' | 'rose' | 'blue' | 'cream'
  prop: 'board' | 'pan' | 'bowl' | 'calculator' | 'box'
}

export type RobotColor = 'blue' | 'yellow' | 'pink' | 'green'

export type RobotMotion = {
  start: { x: number; y: number }
  control1: { x: number; y: number }
  control2: { x: number; y: number }
  end: { x: number; y: number }
  startedAt: number
  durationMs: number
}

export type RobotWorkflow = {
  id: string
  name: string
  color: RobotColor
  position: { x: number; y: number }
  board: KitchenBoard | null
  status: RobotWorkflowStatus
  targetStationId: KitchenStationId
  expectedStationId: KitchenStationId
  currentStationId?: KitchenStationId
  wrongStationId?: KitchenStationId
  motion?: RobotMotion
  travelMs: number
  message: string
  availableAt: number
  waitStartedAt?: number
  cycle: number
  forceNextError: boolean
  shouldForceStuck: boolean
  hasForcedStuck: boolean
}

export type RobotTrace = {
  id: string
  robotId: string
  color: RobotColor
  x: number
  y: number
  createdAt: number
}

export type KitchenState = {
  robots: RobotWorkflow[]
  submittedBoards: KitchenBoard[]
  boardSequence: number
  blankBoardCount: number
  nextBoardRefillAt: number
  traces: RobotTrace[]
}

type ErrorOption = {
  stepIndex: number
  errorType: ErrorType
  expression: string
  correctedExpression: string
}

type EquationTemplate = {
  id: string
  equation: string
  steps: Omit<StepPlan, 'id'>[]
  errorOptions: ErrorOption[]
}

const stationByOperation: Record<AlgebraOperation, KitchenStationId> = {
  distribute: 'distribute',
  combine_like_terms: 'combine',
  add_subtract: 'add_subtract',
  multiply_divide: 'multiply_divide',
  simplify: 'simplify',
  check: 'check',
}

export const kitchenStations: KitchenStation[] = [
  {
    id: 'start',
    label: 'New Boards',
    helper: 'Start',
    x: 15,
    y: 24,
    tone: 'cream',
    prop: 'board',
  },
  {
    id: 'distribute',
    label: 'Distribute',
    helper: 'a(b + c)',
    x: 32,
    y: 31,
    tone: 'mint',
    prop: 'pan',
  },
  {
    id: 'combine',
    label: 'Combine Like Terms',
    helper: '3x + 2x',
    x: 55,
    y: 30,
    tone: 'gold',
    prop: 'bowl',
  },
  {
    id: 'add_subtract',
    label: 'Add / Subtract',
    helper: 'Both sides',
    x: 76,
    y: 31,
    tone: 'rose',
    prop: 'pan',
  },
  {
    id: 'multiply_divide',
    label: 'Multiply / Divide',
    helper: 'Both sides',
    x: 26,
    y: 67,
    tone: 'blue',
    prop: 'bowl',
  },
  {
    id: 'simplify',
    label: 'Simplify',
    helper: 'Reduce',
    x: 49,
    y: 69,
    tone: 'mint',
    prop: 'pan',
  },
  {
    id: 'check',
    label: 'Check Solution',
    helper: 'Plug it in',
    x: 70,
    y: 68,
    tone: 'gold',
    prop: 'calculator',
  },
  {
    id: 'solution',
    label: 'Solution Box',
    helper: 'Drop off',
    x: 86,
    y: 70,
    tone: 'cream',
    prop: 'box',
  },
]

export const errorLibrary: Record<ErrorType, string> = {
  sign_swap_subtract: 'Sign swap while undoing addition or subtraction',
  divide_one_side_only: 'Divided only one side of the equation',
  forget_to_distribute: 'Forgot to distribute to every term',
  combine_unlike_terms: 'Combined terms that do not belong together',
  drop_negative: 'Dropped a negative sign',
  bad_arithmetic: 'Arithmetic slip',
}

const equationTemplates: EquationTemplate[] = [
  {
    id: 'five-x-plus-three',
    equation: '5x + 3 = 18',
    steps: [
      step('5x + 3 = 18', 'simplify', 'start'),
      step('5x = 15', 'add_subtract'),
      step('x = 3', 'multiply_divide'),
      step('Check: 5(3) + 3 = 18', 'check'),
    ],
    errorOptions: [
      error(1, 'sign_swap_subtract', '5x = 21', '5x = 15'),
      error(2, 'divide_one_side_only', 'x = 15', 'x = 3'),
      error(2, 'bad_arithmetic', 'x = 4', 'x = 3'),
    ],
  },
  {
    id: 'two-x-plus-four',
    equation: '2x + 4 = 14',
    steps: [
      step('2x + 4 = 14', 'simplify', 'start'),
      step('2x = 10', 'add_subtract'),
      step('x = 5', 'multiply_divide'),
      step('Check: 2(5) + 4 = 14', 'check'),
    ],
    errorOptions: [
      error(1, 'sign_swap_subtract', '2x = 18', '2x = 10'),
      error(2, 'divide_one_side_only', 'x = 10', 'x = 5'),
      error(2, 'bad_arithmetic', 'x = 6', 'x = 5'),
    ],
  },
  {
    id: 'three-x-minus-seven',
    equation: '3x - 7 = 11',
    steps: [
      step('3x - 7 = 11', 'simplify', 'start'),
      step('3x = 18', 'add_subtract'),
      step('x = 6', 'multiply_divide'),
      step('Check: 3(6) - 7 = 11', 'check'),
    ],
    errorOptions: [
      error(1, 'drop_negative', '3x = 4', '3x = 18'),
      error(2, 'divide_one_side_only', 'x = 18', 'x = 6'),
      error(2, 'bad_arithmetic', 'x = 5', 'x = 6'),
    ],
  },
  {
    id: 'four-distribute',
    equation: '4(x + 2) = 20',
    steps: [
      step('4(x + 2) = 20', 'simplify', 'start'),
      step('4x + 8 = 20', 'distribute'),
      step('4x = 12', 'add_subtract'),
      step('x = 3', 'multiply_divide'),
      step('Check: 4(3 + 2) = 20', 'check'),
    ],
    errorOptions: [
      error(1, 'forget_to_distribute', '4x + 2 = 20', '4x + 8 = 20'),
      error(2, 'sign_swap_subtract', '4x = 28', '4x = 12'),
      error(3, 'divide_one_side_only', 'x = 12', 'x = 3'),
    ],
  },
  {
    id: 'combine-five-x',
    equation: '3x + 2x = 25',
    steps: [
      step('3x + 2x = 25', 'simplify', 'start'),
      step('5x = 25', 'combine_like_terms'),
      step('x = 5', 'multiply_divide'),
      step('Check: 3(5) + 2(5) = 25', 'check'),
    ],
    errorOptions: [
      error(1, 'combine_unlike_terms', '5x^2 = 25', '5x = 25'),
      error(1, 'bad_arithmetic', '6x = 25', '5x = 25'),
      error(2, 'divide_one_side_only', 'x = 25', 'x = 5'),
    ],
  },
]

export function createInitialKitchenState(now = Date.now()): KitchenState {
  const robots = [
    createRobot('byte', 'Byte', 'blue', 0, true, false, now),
    createRobot('nibi', 'Nibi', 'yellow', 1, false, true, now + 450),
    createRobot('pippa', 'Pippa', 'pink', 2, false, false, now + 900),
  ]

  return {
    robots,
    submittedBoards: [],
    boardSequence: 0,
    blankBoardCount: 5,
    nextBoardRefillAt: now + 14000,
    traces: [],
  }
}

export function stationForOperation(operation: AlgebraOperation) {
  return stationByOperation[operation]
}

export function getStation(stationId: KitchenStationId) {
  return kitchenStations.find((station) => station.id === stationId) ?? kitchenStations[0]
}

export function createKitchenBoard(
  sequence: number,
  robotId: string,
  forceError = false,
): KitchenBoard {
  const template = equationTemplates[sequence % equationTemplates.length]
  const plan = template.steps.map((templateStep, index) => ({
    ...templateStep,
    id: `${robotId}-${sequence}-step-${index}`,
    stationId: templateStep.stationId ?? stationForOperation(templateStep.operation),
  }))

  const shouldAddError = forceError || sequence % 3 === 1 || Math.random() < 0.24
  if (shouldAddError) {
    const errorOptionIndex = forceError
      ? 0
      : Math.floor(Math.random() * template.errorOptions.length)
    const errorOption = template.errorOptions[errorOptionIndex]
    const target = plan[errorOption.stepIndex]

    plan[errorOption.stepIndex] = {
      ...target,
      expression: errorOption.expression,
      isError: true,
      errorType: errorOption.errorType,
      correctedExpression: errorOption.correctedExpression,
    }
  }

  return {
    id: `${robotId}-board-${sequence}`,
    templateId: template.id,
    robotId,
    equation: template.equation,
    plan,
    steps: [],
    nextStepIndex: 0,
    status: 'working',
  }
}

export function boardHasUnresolvedError(board: KitchenBoard) {
  return board.steps.some((stepItem) => stepItem.isError && !stepItem.wasCorrected)
}

export function nextBoardStatus(board: KitchenBoard): BoardStatus {
  return boardHasUnresolvedError(board) ? 'needs_review' : 'complete'
}

export function pickWrongStation(expectedStationId: KitchenStationId, seed: string) {
  const options = kitchenStations
    .map((station) => station.id)
    .filter((stationId) => stationId !== expectedStationId && stationId !== 'start' && stationId !== 'solution')
  const seedTotal = seed.split('').reduce((total, character) => total + character.charCodeAt(0), 0)

  return options[seedTotal % options.length]
}

export function travelTime(from: { x: number; y: number }, to: { x: number; y: number }) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  return 180 + distance * 42
}

function createRobot(
  id: string,
  name: string,
  color: RobotColor,
  sequence: number,
  forceError: boolean,
  forceStuck: boolean,
  startAt: number,
): RobotWorkflow {
  const startStation = getStation('start')

  return {
    id,
    name,
    color,
    position: { x: startStation.x, y: startStation.y + 10 + sequence * 4 },
    board: null,
    status: 'moving',
    targetStationId: 'start',
    expectedStationId: 'start',
    travelMs: 900,
    message: 'Picking up a fresh board.',
    availableAt: startAt + 700 + sequence * 260,
    cycle: 0,
    forceNextError: forceError,
    shouldForceStuck: forceStuck,
    hasForcedStuck: false,
  }
}

function step(expression: string, operation: AlgebraOperation, stationId = stationByOperation[operation]) {
  return {
    expression,
    operation,
    stationId,
  }
}

function error(
  stepIndex: number,
  errorType: ErrorType,
  expression: string,
  correctedExpression: string,
) {
  return {
    stepIndex,
    errorType,
    expression,
    correctedExpression,
  }
}
