import byteBalance from './demo-content/byte-balance.md?raw'
import type { DemoScript, DemoSuggestion } from './types'

function readField(source: string, field: string) {
  const match = source.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
  return cleanText(match?.[1].trim() ?? '')
}

function readSection(source: string, heading: string) {
  const match = source.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`))
  return cleanText(match?.[1].trim() ?? '')
}

function cleanText(text: string) {
  return text.replace(/`([^`]+)`/g, '$1')
}

function parseSuggestions(source: string): DemoSuggestion[] {
  const section = readSection(source, 'Suggestions')
  const chunks = section.split(/\n### /).filter(Boolean)

  return chunks.map((chunk, index) => {
    const student = cleanText(chunk.match(/Student:\s*([\s\S]*?)(?=\nBot:|$)/)?.[1].trim() ?? '')
    const bot = cleanText(chunk.match(/Bot:\s*([\s\S]*)/)?.[1].trim() ?? '')

    return {
      id: `suggestion-${index + 1}`,
      student,
      bot,
    }
  }).filter((suggestion) => suggestion.student && suggestion.bot)
}

function parseWhiteboardSteps(source: string) {
  return readSection(source, 'Whiteboard')
    .split('\n')
    .map((line) => cleanText(line.replace(/^-\s*/, '').trim()))
    .filter(Boolean)
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
  }
}

const demoScripts = [parseDemoScript(byteBalance, 'byte-balance')]

export function getDemoScriptForPet(petId: string) {
  return demoScripts.find((script) => script.petId === petId)
}
