import { actionCatalog, executableActions } from './action-catalog.js'
import { validateStructure } from './decision-schema.js'

export function validateDecision(decision, state) {
  const structural = validateStructure(decision)
  if (!structural.ok) {
    return classification('INVALID_REPAIRABLE', false, false, structural.error, executableActions(state))
  }
  if (!actionCatalog[decision.action].requires(state)) {
    return classification(
      'INVALID_REPAIRABLE',
      true,
      false,
      {
        code: 'PRECONDITION_NOT_MET',
        message: `Action ${decision.action} cannot start in the current state`,
        details: { invalidAction: decision.action }
      },
      executableActions(state)
    )
  }
  return classification('VALID', true, true, null, executableActions(state))
}

function classification(status, structural, executable, error, validActionsNow) {
  return { status, structural, executable, error, validActionsNow }
}
