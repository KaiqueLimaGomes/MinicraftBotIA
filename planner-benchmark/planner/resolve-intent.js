import { actionCatalog, normalizeTarget } from './action-catalog.js'

export const defaultQuantities = {
  collect_wood: 8,
  craft_planks: 4,
  craft_crafting_table: 1,
  craft_tool: 1,
  collect_food: 2,
  eat_food: 1,
  mine_stone: 16,
  mine_coal: 8,
  mine_iron: 8,
  build_temporary_shelter: 1,
  return_to_base: 0,
  store_items: 0,
  flee_threat: 0,
  explore_area: 0,
  wait: 0
}

export function resolveIntent(intent, state) {
  const rule = actionCatalog[intent.action]
  if (!rule) return { ok: false, error: { code: 'UNKNOWN_ACTION', details: { action: intent.action } } }

  const target = resolveTarget(intent.action, state, rule.validTargets)
  if (!target) {
    return { ok: false, error: { code: 'INVALID_TARGET', details: { action: intent.action } } }
  }

  return {
    ok: true,
    decision: {
      goal: intent.goal,
      action: intent.action,
      target,
      quantity: clamp(defaultQuantities[intent.action], rule.quantity.min, rule.quantity.max),
      priority: intent.priority,
      reason: intent.reason
    },
    mechanicalRepairs: [
      { field: 'target', value: target, reason: 'DETERMINISTIC_TARGET' },
      { field: 'quantity', value: defaultQuantities[intent.action], reason: 'DEFAULT_QUANTITY' }
    ]
  }
}

export function executableActionSpecs(state) {
  return Object.entries(actionCatalog)
    .filter(([, rule]) => rule.requires(state))
    .map(([action, rule]) => ({
      action,
      targets: candidateTargets(action, state, rule.validTargets),
      quantity: rule.quantity
    }))
}

function resolveTarget(action, state, validTargets) {
  return candidateTargets(action, state, validTargets)[0] ?? validTargets[0] ?? null
}

function candidateTargets(action, state, validTargets) {
  const observed = [...(state.nearby ?? []), ...Object.keys(state.inventory ?? {})].map(normalizeTarget)
  const observedValid = validTargets.filter(target => observed.includes(normalizeTarget(target)))
  if (observedValid.length) return observedValid

  const preferred = {
    craft_planks: 'oak_planks',
    craft_crafting_table: 'crafting_table',
    craft_tool: (state.inventory?.cobblestone ?? 0) >= 3 ? 'stone_pickaxe' : 'wooden_pickaxe',
    build_temporary_shelter: 'near_current_position',
    return_to_base: 'base_location',
    store_items: 'base_chest',
    flee_threat: ['zombie', 'skeleton', 'creeper', 'spider'].find(x => state.nearby?.includes(x)) ?? 'safe_location',
    explore_area: 'nearby_area',
    wait: 'near_current_position'
  }[action]
  return preferred && validTargets.includes(preferred) ? [preferred] : validTargets
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
