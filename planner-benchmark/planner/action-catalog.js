export const targetAliases = {
  tree: 'oak_tree',
  wood: 'oak_log',
  planks: 'oak_planks',
  food: 'food',
  raw_beef: 'beef',
  raw_mutton: 'mutton',
  raw_porkchop: 'porkchop',
  raw_chicken: 'chicken',
  tool: 'wooden_pickaxe',
  shelter: 'temporary_shelter',
  base: 'base_location',
  chest: 'base_chest',
  storage: 'base_chest',
  away_from_threat: 'safe_location',
  current_position: 'near_current_position',
  safe_position: 'safe_location',
  area: 'nearby_area',
  unknown_area: 'nearby_area'
}

export const actionCatalog = {
  collect_wood: rule(['oak_tree'], [1, 16], state => nearby(state, 'oak_tree')),
  craft_planks: rule(['oak_planks'], [1, 64], state => countItem(state, 'oak_log') >= 1),
  craft_crafting_table: rule(['crafting_table'], [1, 1], state =>
    !state.hasCraftingTable && countItem(state, 'oak_planks') >= 4),
  craft_tool: rule(
    ['wooden_pickaxe', 'wooden_axe', 'stone_pickaxe', 'stone_axe'],
    [1, 2],
    state => state.hasCraftingTable &&
      (countItem(state, 'oak_planks') >= 3 || countItem(state, 'cobblestone') >= 3) &&
      countItem(state, 'stick') >= 2
  ),
  collect_food: rule(
    ['cow', 'sheep', 'pig', 'chicken'],
    [1, 8],
    state => ['cow', 'sheep', 'pig', 'chicken'].some(item => nearby(state, item))
  ),
  eat_food: rule(
    ['beef', 'cooked_beef', 'mutton', 'cooked_mutton', 'porkchop', 'cooked_porkchop', 'chicken', 'cooked_chicken', 'bread', 'apple'],
    [1, 1],
    hasAnyFood
  ),
  mine_stone: rule(['stone', 'cobblestone'], [1, 32], state => hasTool(state, 'pickaxe') && nearby(state, 'stone')),
  mine_coal: rule(['coal_ore', 'coal'], [1, 16], state => hasTool(state, 'pickaxe') && nearby(state, 'coal_ore')),
  mine_iron: rule(['iron_ore'], [1, 16], state => hasTool(state, 'stone_pickaxe') && nearby(state, 'iron_ore')),
  build_temporary_shelter: rule(
    ['near_current_position', 'base_location', 'temporary_shelter'],
    [1, 1],
    state => state.shelterStatus === 'absent' && buildingBlocks(state) >= 12
  ),
  return_to_base: rule(['base_location'], [0, 0], state => state.baseStatus === 'known'),
  store_items: rule(['base_chest'], [0, 64], state => state.baseStatus === 'known' && state.hasChest && state.inventoryFull),
  flee_threat: rule(
    ['safe_location', 'base_location', 'zombie', 'skeleton', 'creeper', 'spider', 'hostile_mob'],
    [0, 0],
    state => state.threatImmediate
  ),
  explore_area: rule(['nearby_area'], [0, 0], state => !state.threatImmediate && state.hunger > 6),
  wait: rule(['near_current_position', 'safe_location'], [0, 0], () => true)
}

export const allowedActions = Object.keys(actionCatalog)

export function normalizeState(input = {}) {
  const shelterStatus = input.shelterStatus ??
    (input.shelter === true ? 'present' : input.shelter === false ? 'absent' : 'unknown')
  const baseStatus = input.baseStatus ??
    (input.baseKnown === true ? 'known' : input.baseKnown === false ? 'unknown' : 'unknown')
  return {
    time: input.time ?? 'unknown',
    timeUntilNightSeconds: input.timeUntilNightSeconds ?? null,
    health: input.health ?? 20,
    hunger: input.hunger ?? 20,
    inventory: input.inventory ?? {},
    inventoryFull: Boolean(input.inventoryFull),
    nearby: input.nearby ?? [],
    shelterStatus,
    shelter: shelterStatus === 'present',
    tools: input.tools ?? [],
    hasCraftingTable: Boolean(input.hasCraftingTable),
    baseStatus,
    baseKnown: baseStatus === 'known',
    base: input.base ?? null,
    hasChest: Boolean(input.hasChest),
    threatImmediate: Boolean(input.threatImmediate)
  }
}

export function executableActions(state) {
  return allowedActions.filter(action => actionCatalog[action].requires(state))
}

export function admissibleActions(state) {
  const actions = executableActions(state).filter(action => isStrategicallyAdmissible(action, state))
  return actions.length > 1 ? actions.filter(action => action !== 'wait') : actions
}

export function isStrategicallyAdmissible(action, state) {
  const foodPriority = prioritizedFoodAction(state)
  if (foodPriority) return action === foodPriority
  if (action === 'collect_wood') return isWoodCollectionAdmissible(state)
  if (action === 'explore_area') return isExplorationAdmissible(state)
  if (action === 'build_temporary_shelter') return isShelterAdmissible(state)
  return true
}

export function prioritizedFoodAction(state) {
  if (state.hunger > 14) return null
  if (hasAnyFood(state)) return 'eat_food'
  const animalNearby = ['cow', 'sheep', 'pig', 'chicken'].some(item => nearby(state, item))
  return animalNearby ? 'collect_food' : null
}

export function isWoodCollectionAdmissible(state) {
  return countItem(state, 'oak_log') < 8 && countItem(state, 'oak_planks') < 4
}

export function isExplorationAdmissible(state) {
  return !state.threatImmediate &&
    state.hunger >= 14 &&
    hasTool(state, 'pickaxe') &&
    Number(state.timeUntilNightSeconds ?? 0) > 240 &&
    !hasDirectProgressAction(state)
}

export function isShelterAdmissible(state) {
  const urgent = state.time === 'dusk' || state.time === 'night' ||
    Number(state.timeUntilNightSeconds ?? Infinity) <= 180
  return state.shelterStatus === 'absent' && buildingBlocks(state) >= 12 && urgent
}

export function normalizeTarget(target) {
  const value = String(target ?? '').trim().toLowerCase().replaceAll(' ', '_')
  return targetAliases[value] ?? value
}

export function countItem(state, item) {
  return Number(state.inventory?.[item] ?? 0)
}

export function hasTool(state, fragment) {
  return (state.tools ?? []).some(tool => tool.includes(fragment)) ||
    Object.keys(state.inventory ?? {}).some(item => item.includes(fragment))
}

export function hasAnyFood(state) {
  const foods = ['beef', 'raw_beef', 'cooked_beef', 'mutton', 'raw_mutton', 'cooked_mutton',
    'porkchop', 'raw_porkchop', 'cooked_porkchop', 'chicken', 'raw_chicken',
    'cooked_chicken', 'bread', 'apple']
  return foods.some(item => countItem(state, item) > 0)
}

export function buildingBlocks(state) {
  return ['oak_log', 'oak_planks', 'cobblestone', 'dirt', 'stone']
    .reduce((sum, item) => sum + countItem(state, item), 0)
}

function hasDirectProgressAction(state) {
  if (Object.keys(state.inventory ?? {}).length === 0 && nearby(state, 'oak_tree')) return true
  if (countItem(state, 'oak_log') > 0 && countItem(state, 'oak_planks') === 0) return true
  if (!state.hasCraftingTable && (countItem(state, 'oak_planks') >= 4 || countItem(state, 'oak_log') >= 1)) return true
  if (!hasTool(state, 'pickaxe') && state.hasCraftingTable) return true
  if (state.hunger <= 14 && ['cow', 'sheep', 'pig', 'chicken'].some(item => nearby(state, item))) return true
  if (nearby(state, 'coal_ore') && hasTool(state, 'pickaxe')) return true
  if (nearby(state, 'iron_ore') && hasTool(state, 'stone_pickaxe')) return true
  return false
}

function rule(validTargets, [min, max], requires) {
  return { validTargets, quantity: { min, max }, requires }
}

function nearby(state, item) {
  return (state.nearby ?? []).includes(item)
}
