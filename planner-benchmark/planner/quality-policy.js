import { admissibleActions } from './action-catalog.js'
import { fallbackDecision } from './fallback-policy.js'

export function assessQuality(decision, state) {
  const policy = qualityPolicy(state)
  if (policy.preferred.includes(decision.action)) {
    return { status: 'VALID_PREFERRED', ...policy }
  }
  if (policy.acceptable.includes(decision.action)) {
    return { status: 'VALID_ACCEPTABLE', ...policy }
  }
  return {
    status: 'VALID_SUBOPTIMAL',
    ...policy,
    message: `Decision is catalog-executable, but policy discourages ${decision.action}`
  }
}

export function qualityPolicy(state) {
  const actions = admissibleActions(state)
  const preferredAction = fallbackDecision(state).action
  const preferred = actions.includes(preferredAction) ? [preferredAction] : []
  const discouraged = actions.filter(action =>
    action === 'explore_area' || (action === 'wait' && actions.length > 1))
  const acceptable = actions.filter(action =>
    !preferred.includes(action) && !discouraged.includes(action))
  return { preferred, acceptable, discouraged, forbidden: [] }
}
