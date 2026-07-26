import { allowedActions, executableActions, normalizeState } from './action-catalog.js'
import { parseStrictJson } from './decision-schema.js'
import { fallbackDecision } from './fallback-policy.js'
import { normalizeDecision } from './normalize-decision.js'
import { assessQuality } from './quality-policy.js'
import { safetyOverride } from './safety-policy.js'
import { validateDecision } from './validate-decision.js'

export function createPlanner({ generate }) {
  return {
    async decide(inputState) {
      const state = normalizeState(inputState)
      const forced = safetyOverride(state)
      if (forced) return result(forced, 'safety_override', false, false, validateDecision(forced, state), 0)

      let attempts = 0
      let raw = await generate(buildPrompt(state))
      attempts++
      let candidate = parseAndNormalize(raw)
      let validation = candidate.ok
        ? validateDecision(candidate.value, state)
        : parseFailure(candidate.error, state)

      if (validation.status === 'VALID') {
        return result(candidate.value, 'llm', false, false, withQuality(validation, candidate.value, state), attempts)
      }

      raw = await generate(buildRepairPrompt(state, raw, validation))
      attempts++
      candidate = parseAndNormalize(raw)
      validation = candidate.ok
        ? validateDecision(candidate.value, state)
        : parseFailure(candidate.error, state)

      if (validation.status === 'VALID') {
        return result(candidate.value, 'llm_repair', true, false, withQuality(validation, candidate.value, state), attempts)
      }

      const fallback = fallbackDecision(state)
      return result(fallback, 'fallback', true, true, validateDecision(fallback, state), attempts)
    }
  }
}

function withQuality(validation, decision, state) {
  const quality = assessQuality(decision, state)
  return { ...validation, status: quality.status, quality }
}

function parseAndNormalize(raw) {
  const parsed = parseStrictJson(raw)
  return parsed.ok ? { ok: true, value: normalizeDecision(parsed.value) } : parsed
}

function parseFailure(error, state) {
  return {
    status: 'INVALID_REPAIRABLE',
    structural: false,
    executable: false,
    error,
    validActionsNow: executableActions(state)
  }
}

function buildPrompt(state) {
  return `${rules()}\nState:\n${JSON.stringify(state)}\nChoose the single best next action.`
}

function buildRepairPrompt(state, invalidResponse, validation) {
  return `${rules()}
State:
${JSON.stringify(state)}
The previous response was invalid:
${JSON.stringify({
  error: validation.error?.code,
  details: validation.error?.details,
  invalid_response: invalidResponse,
  valid_actions_now: validation.validActionsNow
})}
Correct it once. Return only the corrected JSON object.`
}

function rules() {
  return `You are the planner for a Minecraft survival bot.
Return ONLY valid JSON with this schema:
{"goal":"string","action":"string","target":"string","quantity":0,"priority":1,"reason":"string"}
Allowed actions: ${allowedActions.join(', ')}
Never select an action that cannot start from the observed state.
Use progression only when its required prerequisite is actually missing.
Never repeat a completed progression step.
Inventory, threats, hunger and time override generic progression.`
}

function result(decision, source, repaired, fallbackUsed, validation, attempts) {
  return {
    decision,
    source,
    repaired,
    fallbackUsed,
    attempts,
    validation: {
      classification: validation.status,
      structural: validation.structural,
      executable: validation.executable,
      safetyApproved: source !== 'llm' || validation.status === 'VALID'
    }
  }
}
