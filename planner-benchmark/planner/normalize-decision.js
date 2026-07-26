import { normalizeTarget } from './action-catalog.js'

export function normalizeDecision(decision) {
  return {
    ...decision,
    action: String(decision.action ?? '').trim().toLowerCase().replaceAll(' ', '_'),
    target: normalizeTarget(decision.target)
  }
}
