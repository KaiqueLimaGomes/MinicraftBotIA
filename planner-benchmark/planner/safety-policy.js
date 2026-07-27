import { buildingBlocks, hasAnyFood } from './action-catalog.js'

export function safetyOverride(state) {
  if (state.threatImmediate && state.health <= 10) {
    return decision('flee_threat', threatTarget(state), 0, 10, 'Immediate threat with low health')
  }
  if (state.hunger <= 6 && hasAnyFood(state)) {
    return decision('eat_food', firstFood(state), 1, 10, 'Critical hunger and food is available')
  }
  if (state.hunger <= 6) {
    const animal = ['cow', 'sheep', 'pig', 'chicken'].find(item => state.nearby.includes(item))
    if (animal) return decision('collect_food', animal, 2, 10, 'Critical hunger and food source is nearby')
  }
  if (state.inventoryFull && state.baseKnown) {
    return state.hasChest
      ? decision('store_items', 'base_chest', 0, 9, 'Inventory is full and storage is known')
      : decision('return_to_base', 'base_location', 0, 9, 'Inventory is full')
  }
  if (state.shelterStatus === 'absent' && state.timeUntilNightSeconds !== null &&
      state.timeUntilNightSeconds <= 120 && buildingBlocks(state) >= 12) {
    return decision('build_temporary_shelter', 'near_current_position', 1, 9, 'Night is imminent')
  }
  return null
}

function decision(action, target, quantity, priority, reason) {
  return { goal: 'survive', action, target, quantity, priority, reason }
}

function firstFood(state) {
  const item = ['cooked_beef', 'beef', 'raw_beef', 'cooked_mutton', 'mutton', 'raw_mutton',
    'cooked_porkchop', 'porkchop', 'raw_porkchop', 'cooked_chicken', 'chicken',
    'raw_chicken', 'bread', 'apple'].find(item => Number(state.inventory[item] ?? 0) > 0) ?? 'beef'
  return canonicalFoodTarget(item)
}

function threatTarget(state) {
  return ['zombie', 'skeleton', 'creeper', 'spider'].find(item => state.nearby.includes(item)) ?? 'hostile_mob'
}

function canonicalFoodTarget(item) {
  return {
    raw_beef: 'beef',
    raw_mutton: 'mutton',
    raw_porkchop: 'porkchop',
    raw_chicken: 'chicken'
  }[item] ?? item
}
