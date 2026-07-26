import { actionCatalog } from './action-catalog.js'

export function parseStrictJson(text) {
  if (typeof text !== 'string') return { ok: false, error: error('INVALID_JSON', 'Response is not text') }
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return { ok: false, error: error('JSON_NOT_PURE', 'Response must contain only one JSON object') }
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch {
    return { ok: false, error: error('INVALID_JSON', 'Response is not valid JSON') }
  }
}

export function validateStructure(decision) {
  const required = ['goal', 'action', 'target', 'quantity', 'priority', 'reason']
  const missing = required.filter(field => !(field in decision))
  if (missing.length) return invalid('MISSING_FIELDS', { missing })
  if (typeof decision.goal !== 'string' || typeof decision.action !== 'string' ||
      typeof decision.target !== 'string' || typeof decision.reason !== 'string' ||
      !Number.isInteger(decision.quantity) || !Number.isInteger(decision.priority)) {
    return invalid('INVALID_FIELD_TYPES')
  }
  if (decision.priority < 1 || decision.priority > 10) return invalid('PRIORITY_OUT_OF_RANGE')
  if (decision.quantity < 0 || decision.quantity > 64) return invalid('QUANTITY_OUT_OF_RANGE')
  if (!actionCatalog[decision.action]) return invalid('UNKNOWN_ACTION', { action: decision.action })
  const rule = actionCatalog[decision.action]
  if (decision.quantity < rule.quantity.min || decision.quantity > rule.quantity.max) {
    return invalid('ACTION_QUANTITY_OUT_OF_RANGE', { expected: rule.quantity, actual: decision.quantity })
  }
  if (!rule.validTargets.includes(decision.target)) {
    return invalid('INVALID_TARGET', { validTargets: rule.validTargets, actual: decision.target })
  }
  return { ok: true }
}

function invalid(code, details = {}) {
  return { ok: false, error: error(code, code, details) }
}

function error(code, message, details = {}) {
  return { code, message, details }
}
