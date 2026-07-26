import { buildingBlocks, hasAnyFood, hasTool } from './action-catalog.js'
import { safetyOverride } from './safety-policy.js'

export function fallbackDecision(state) {
  const safety = safetyOverride(state)
  if (safety) return safety
  if (Object.keys(state.inventory).length === 0 && state.nearby.includes('oak_tree')) return d('collect_wood', 'oak_tree', 8)
  if ((state.inventory.oak_log ?? 0) > 0 && (state.inventory.oak_planks ?? 0) === 0) return d('craft_planks', 'oak_planks', 8)
  if (!state.hasCraftingTable && ((state.inventory.oak_planks ?? 0) >= 4 || (state.inventory.oak_log ?? 0) >= 1)) {
    return d('craft_crafting_table', 'crafting_table', 1)
  }
  if (state.hasCraftingTable && !hasTool(state, 'pickaxe') &&
      (state.inventory.stick ?? 0) >= 2 &&
      ((state.inventory.oak_planks ?? 0) >= 3 || (state.inventory.cobblestone ?? 0) >= 3)) {
    return d('craft_tool', (state.inventory.cobblestone ?? 0) >= 3 ? 'stone_pickaxe' : 'wooden_pickaxe', 1)
  }
  if (state.hunger <= 12 && hasAnyFood(state)) return d('eat_food', firstFood(state), 1)
  if (state.hunger <= 14) {
    const animal = ['cow', 'sheep', 'pig', 'chicken'].find(item => state.nearby.includes(item))
    if (animal) return d('collect_food', animal, 3)
  }
  if (state.shelterStatus === 'absent' && state.timeUntilNightSeconds !== null && state.timeUntilNightSeconds <= 180 && buildingBlocks(state) >= 12) {
    return d('build_temporary_shelter', 'near_current_position', 1)
  }
  if (state.nearby.includes('coal_ore') && hasTool(state, 'pickaxe')) return d('mine_coal', 'coal_ore', 8)
  if (state.nearby.includes('iron_ore') && hasTool(state, 'stone_pickaxe')) return d('mine_iron', 'iron_ore', 8)
  if (state.nearby.includes('stone') && hasTool(state, 'pickaxe')) return d('mine_stone', 'stone', 16)
  if (state.nearby.includes('oak_tree')) return d('collect_wood', 'oak_tree', 8)
  return d('wait', 'near_current_position', 0)
}

function d(action, target, quantity) {
  return { goal: 'survive', action, target, quantity, priority: 7, reason: 'Deterministic fallback policy' }
}

function firstFood(state) {
  return ['cooked_beef', 'raw_beef', 'cooked_mutton', 'raw_mutton', 'cooked_porkchop',
    'raw_porkchop', 'bread', 'apple'].find(item => Number(state.inventory[item] ?? 0) > 0)
}
