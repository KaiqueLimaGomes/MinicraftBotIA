import { actionCatalog } from './action-catalog.js'

export function validateIntent(intent) {
  const required = ['goal', 'action', 'priority', 'reason']
  const missing = required.filter(field => !(field in intent))
  if (missing.length) return invalid('INVALID_SCHEMA', { missing })
  if (typeof intent.goal !== 'string' || typeof intent.action !== 'string' ||
      typeof intent.reason !== 'string' || !Number.isInteger(intent.priority)) {
    return invalid('INVALID_SCHEMA', { message: 'Invalid intent field types' })
  }
  if (intent.priority < 1 || intent.priority > 10) {
    return invalid('INVALID_SCHEMA', { field: 'priority', range: [1, 10] })
  }
  if (!actionCatalog[intent.action]) return invalid('UNKNOWN_ACTION', { action: intent.action })
  return { ok: true }
}

function invalid(code, details) {
  return { ok: false, error: { code, details } }
}
