import { admissibleActions, normalizeState } from './action-catalog.js'
import { parseStrictJson } from './decision-schema.js'
import { failureRecord } from './failure-taxonomy.js'
import { fallbackDecision } from './fallback-policy.js'
import { validateIntent } from './intent-schema.js'
import { assessQuality } from './quality-policy.js'
import { executableActionSpecs, resolveIntent } from './resolve-intent.js'
import { safetyOverride } from './safety-policy.js'
import { validateDecision } from './validate-decision.js'

export function createPlanner({ generate }) {
  return {
    async decide(inputState) {
      const state = normalizeState(inputState)
      const failures = []
      const forced = safetyOverride(state)
      if (forced) {
        failures.push({ stage: 'safety', category: 'SAFETY_OVERRIDE', code: 'SAFETY_OVERRIDE' })
        return result(forced, 'safety_override', false, false, validateDecision(forced, state), 0, failures, [])
      }

      let attempts = 0
      let candidate = await requestIntent(generate, buildPrompt(state), state)
      attempts++

      if (candidate.ok) {
        const validation = validateCandidate(candidate.decision, state)
        if (validation.status === 'VALID') {
          return result(candidate.decision, 'llm', false, false,
            withQuality(validation, candidate.decision, state), attempts, failures, candidate.mechanicalRepairs)
        }
        failures.push(failureRecord('initial', validation.error, { originalAction: candidate.decision.action }))
      } else {
        failures.push(failureRecord('initial', candidate.error, { rawResponse: candidate.raw }))
      }

      const repairPrompt = buildRepairPrompt(state, failures.at(-1))
      candidate = await requestIntent(generate, repairPrompt, state)
      attempts++

      if (candidate.ok) {
        const validation = validateCandidate(candidate.decision, state)
        if (validation.status === 'VALID') {
          return result(candidate.decision, 'llm_repair', true, false,
            withQuality(validation, candidate.decision, state), attempts, failures, candidate.mechanicalRepairs)
        }
        failures.push(failureRecord('repair', validation.error, { originalAction: candidate.decision.action }))
      } else {
        failures.push(failureRecord('repair', candidate.error, { rawResponse: candidate.raw }))
      }

      failures.push({
        stage: 'fallback',
        category: 'REPAIR_FAILED',
        code: 'REPAIR_FAILED',
        previousCategory: failures.at(-1)?.category
      })
      const fallback = fallbackDecision(state)
      return result(fallback, 'fallback', true, true, validateDecision(fallback, state), attempts, failures, [])
    }
  }
}

function validateCandidate(decision, state) {
  const validation = validateDecision(decision, state)
  if (validation.status !== 'VALID') return validation
  const admissible = admissibleActions(state)
  if (admissible.includes(decision.action) || (admissible.length === 0 && decision.action === 'wait')) {
    return validation
  }
  return {
    ...validation,
    status: 'INVALID_REPAIRABLE',
    error: {
      code: 'STRATEGIC_OVERRIDE',
      details: { action: decision.action, admissibleActions: admissible }
    },
    validActionsNow: admissible
  }
}

async function requestIntent(generate, prompt, state) {
  let raw
  try {
    raw = await generate(prompt)
  } catch (error) {
    return { ok: false, raw: null, error: { code: 'MODEL_UNAVAILABLE', details: { message: error.message } } }
  }
  const parsed = parseStrictJson(raw)
  if (!parsed.ok) return { ok: false, raw, error: parsed.error }
  const intent = {
    goal: parsed.value.goal,
    action: String(parsed.value.action ?? '').trim().toLowerCase().replaceAll(' ', '_'),
    priority: parsed.value.priority,
    reason: parsed.value.reason
  }
  const schema = validateIntent(intent)
  if (!schema.ok) return { ok: false, raw, error: schema.error }
  const resolved = resolveIntent(intent, state)
  return resolved.ok ? { ok: true, raw, ...resolved } : { ok: false, raw, error: resolved.error }
}

function withQuality(validation, decision, state) {
  const quality = assessQuality(decision, state)
  return { ...validation, status: quality.status, quality }
}

function buildPrompt(state) {
  const actions = admissibleActions(state)
  if (!actions.length) actions.push('wait')
  return `You choose one high-level intention for a Minecraft survival bot.
Return ONLY JSON:
{"goal":"string","action":"allowed_action","priority":1,"reason":"string"}
Actions executable now: ${actions.join(', ')}
Choose only from this list. Threats, hunger, inventory and time override progression.
State: ${JSON.stringify(state)}`
}

function buildRepairPrompt(state, failure) {
  return `Your previous Minecraft decision was invalid.
Error: ${JSON.stringify(failure)}
Valid actions now:
${executableActionSpecs(state).map(spec =>
  `- ${spec.action}: targets=[${spec.targets.join(',')}], quantity=${spec.quantity.min}..${spec.quantity.max}`
).join('\n')}
Return ONLY corrected JSON:
{"goal":"string","action":"one_action_from_the_list","priority":1,"reason":"string"}
Do not choose an action outside the list.`
}

function result(decision, source, repaired, fallbackUsed, validation, attempts, failures, mechanicalRepairs) {
  return {
    decision,
    source,
    repaired,
    fallbackUsed,
    attempts,
    failures,
    mechanicalRepairs,
    validation: {
      classification: validation.status,
      structural: validation.structural,
      catalogExecutable: validation.catalogExecutable,
      executable: validation.executable,
      safetyApproved: source === 'safety_override' || validation.executable
    }
  }
}
