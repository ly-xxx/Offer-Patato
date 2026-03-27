import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const demoApiDir = path.join(root, 'web', 'public', 'demo-api')

const requiredFiles = [
  'meta.json',
  'settings-sources.json',
  'questions.json',
  'documents.json',
  'search.json',
  'work-projects.json',
  'agents-jobs.json',
  'agent-job.json',
  'answer-job.json'
]

const errors = []

function readJson(relativePath) {
  const absolutePath = path.join(demoApiDir, relativePath)
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    errors.push(`Invalid JSON: ${relativePath} (${error instanceof Error ? error.message : String(error)})`)
    return null
  }
}

function walkJsonFiles(directory) {
  const entries = readdirSync(directory)
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      files.push(...walkJsonFiles(fullPath))
      continue
    }
    if (entry.endsWith('.json')) {
      files.push(fullPath)
    }
  }

  return files
}

if (!existsSync(demoApiDir)) {
  errors.push('Missing directory: web/public/demo-api')
} else {
  for (const file of requiredFiles) {
    const absolutePath = path.join(demoApiDir, file)
    if (!existsSync(absolutePath)) {
      errors.push(`Missing required file: demo-api/${file}`)
    }
  }

  for (const fullPath of walkJsonFiles(demoApiDir)) {
    const rel = path.relative(demoApiDir, fullPath)
    readJson(rel)
  }

  const questions = readJson('questions.json')
  if (Array.isArray(questions)) {
    for (const item of questions) {
      const id = typeof item?.id === 'string' ? item.id : ''
      if (!id) {
        errors.push('questions.json contains entry without id')
        continue
      }
      if (!existsSync(path.join(demoApiDir, 'questions', `${id}.json`))) {
        errors.push(`Missing question detail fixture: demo-api/questions/${id}.json`)
      }
    }
  }

  const documents = readJson('documents.json')
  if (Array.isArray(documents)) {
    for (const item of documents) {
      const id = typeof item?.id === 'string' ? item.id : ''
      if (!id) {
        errors.push('documents.json contains entry without id')
        continue
      }
      if (!existsSync(path.join(demoApiDir, 'documents', `${id}.json`))) {
        errors.push(`Missing document detail fixture: demo-api/documents/${id}.json`)
      }
    }
  }

  const projects = readJson('work-projects.json')
  if (Array.isArray(projects)) {
    for (const item of projects) {
      const id = typeof item?.id === 'string' ? item.id : ''
      if (!id) {
        errors.push('work-projects.json contains entry without id')
        continue
      }
      if (!existsSync(path.join(demoApiDir, 'work-projects', `${id}.json`))) {
        errors.push(`Missing work project fixture: demo-api/work-projects/${id}.json`)
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Demo API validation failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log('Demo API validation passed.')
