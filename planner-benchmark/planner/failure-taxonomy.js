export const failureCategories = [
  'INVALID_JSON',
  'INVALID_SCHEMA',
  'UNKNOWN_ACTION',
  'INVALID_TARGET',
  'INVALID_QUANTITY',
  'PRECONDITION_NOT_MET',
  'SAFETY_OVERRIDE',
  'STRATEGIC_OVERRIDE',
  'REPAIR_FAILED',
  'MODEL_UNAVAILABLE'
]

export function categorizeError(error) {
  const code = error?.code
  if (code === 'INVALID_JSON' || code === 'JSON_NOT_PURE') return 'INVALID_JSON'
  if (code === 'UNKNOWN_ACTION') return 'UNKNOWN_ACTION'
  if (code === 'INVALID_TARGET') return 'INVALID_TARGET'
  if (code === 'ACTION_QUANTITY_OUT_OF_RANGE' || code === 'QUANTITY_OUT_OF_RANGE') return 'INVALID_QUANTITY'
  if (code === 'PRECONDITION_NOT_MET') return 'PRECONDITION_NOT_MET'
  if (code === 'MODEL_UNAVAILABLE') return 'MODEL_UNAVAILABLE'
  return 'INVALID_SCHEMA'
}

export function failureRecord(stage, error, extra = {}) {
  return {
    stage,
    category: categorizeError(error),
    code: error?.code ?? 'UNKNOWN',
    details: error?.details ?? {},
    ...extra
  }
}
