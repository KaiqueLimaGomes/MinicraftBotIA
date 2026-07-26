import { fallbackDecision } from './fallback-policy.js'

export function assessQuality(decision, state) {
  const recommended = fallbackDecision(state)
  if (decision.action === recommended.action) {
    return { status: 'VALID', recommendedAction: recommended.action }
  }
  return {
    status: 'VALID_SUBOPTIMAL',
    recommendedAction: recommended.action,
    message: `Decision is executable, but policy prefers ${recommended.action}`
  }
}
