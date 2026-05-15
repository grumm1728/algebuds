import byteBalance from './demo-content/byte-balance.md?raw'
import nibiFast from './demo-content/nibi-fast.md?raw'
import pippaCheck from './demo-content/pippa-check.md?raw'
import type { DemoScript, DemoSuggestion, WhiteboardLine } from './types'

function readField(source: string, field: string) {
  const match = source.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
  return cleanText(match?.[1].trim() ?? '')
}

function readSection(source: string, heading: string) {
  const match = source.match(new RegExp(`## ${heading}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`))
  return cleanText(match?.[1].trim() ?? '')
}

function cleanText(text: string) {
  return text.replace(/`([^`]+)`/g, '$1')
}

function parseSuggestions(source: string): DemoSuggestion[] {
  const section = readSection(source, 'Suggestions')
  const chunks = section.split(/\r?\n### /).filter(Boolean)

  return chunks.map((chunk, index) => {
    const student = cleanText(chunk.match(/Student:\s*([\s\S]*?)(?=\r?\nBot:|$)/)?.[1].trim() ?? '')
    const bot = cleanText(chunk.match(/Bot:\s*([\s\S]*)/)?.[1].trim() ?? '')

    return {
      id: `suggestion-${index + 1}`,
      student,
      bot,
    }
  }).filter((suggestion) => suggestion.student && suggestion.bot)
}

function parseWhiteboardLine(line: string): WhiteboardLine {
  if (!line.includes('=')) {
    return {
      kind: 'comment',
      text: line,
    }
  }

  const [left, ...rightParts] = line.split('=')
  const right = rightParts.join('=').trim()

  return {
    kind: 'equation',
    left: left.trim(),
    right,
    text: line,
  }
}

function parseWhiteboardSteps(source: string) {
  return readSection(source, 'Whiteboard')
    .split(/\r?\n/)
    .map((line) => cleanText(line.replace(/^-\s*/, '').trim()))
    .filter(Boolean)
    .map(parseWhiteboardLine)
}

function parseFeedback(source: string): DemoSuggestion {
  const section = readSection(source, 'Feedback')

  return {
    id: 'feedback',
    student: cleanText(section.match(/Student:\s*([\s\S]*?)(?=\r?\nBot:|$)/)?.[1].trim() ?? ''),
    bot: cleanText(section.match(/Bot:\s*([\s\S]*)/)?.[1].trim() ?? ''),
  }
}

function parseDemoScript(source: string, id: string): DemoScript {
  return {
    id,
    petId: readField(source, 'pet'),
    title: source.match(/^#\s+(.+)$/m)?.[1].trim() ?? id,
    opening: readSection(source, 'Opening'),
    problem: readField(source, 'problem'),
    readyMessage: readSection(source, 'Ready'),
    suggestions: parseSuggestions(source),
    whiteboardSteps: parseWhiteboardSteps(source),
    feedback: parseFeedback(source),
  }
}

const demoScripts = [
  parseDemoScript(byteBalance, 'byte-balance'),
  parseDemoScript(nibiFast, 'nibi-fast'),
  parseDemoScript(pippaCheck, 'pippa-check'),
]

export function getDemoScriptForPet(petId: string) {
  return demoScripts.find((script) => script.petId === petId)
}
