export const targetAliases = {
  tree: 'oak_tree',
  wood: 'oak_log',
  planks: 'oak_planks',
  food: 'food',
  beef: 'raw_beef',
  mutton: 'raw_mutton',
  porkchop: 'raw_porkchop',
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
    countItem(state, 'oak_planks') >= 4 || countItem(state, 'oak_log') >= 1),
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
    ['raw_beef', 'cooked_beef', 'raw_mutton', 'cooked_mutton', 'raw_porkchop', 'cooked_porkchop', 'bread', 'apple'],
    [1, 1],
    hasAnyFood
  ),
  mine_stone: rule(['stone', 'cobblestone'], [1, 32], state => hasTool(state, 'pickaxe') && nearby(state, 'stone')),
  mine_coal: rule(['coal_ore', 'coal'], [1, 16], state => hasTool(state, 'pickaxe') && nearby(state, 'coal_ore')),
  mine_iron: rule(['iron_ore'], [1, 16], state => hasTool(state, 'stone_pickaxe') && nearby(state, 'iron_ore')),
  build_temporary_shelter: rule(
    ['near_current_position', 'base_location', 'temporary_shelter'],
    [1, 1],
    state => buildingBlocks(state) >= 12
  ),
  return_to_base: rule(['base_location'], [0, 0], state => state.baseKnown),
  store_items: rule(['base_chest'], [0, 64], state => state.baseKnown && state.hasChest && state.inventoryFull),
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
  return {
    time: input.time ?? 'unknown',
    timeUntilNightSeconds: input.timeUntilNightSeconds ?? null,
    health: input.health ?? 20,
    hunger: input.hunger ?? 20,
    inventory: input.inventory ?? {},
    inventoryFull: Boolean(input.inventoryFull),
    nearby: input.nearby ?? [],
    shelter: Boolean(input.shelter),
    tools: input.tools ?? [],
    hasCraftingTable: Boolean(input.hasCraftingTable),
    baseKnown: Boolean(input.baseKnown),
    hasChest: Boolean(input.hasChest),
    threatImmediate: Boolean(input.threatImmediate)
  }
}

export function executableActions(state) {
  return allowedActions.filter(action => actionCatalog[action].requires(state))
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
  const foods = ['raw_beef', 'cooked_beef', 'raw_mutton', 'cooked_mutton', 'raw_porkchop',
    'cooked_porkchop', 'raw_chicken', 'cooked_chicken', 'bread', 'apple']
  return foods.some(item => countItem(state, item) > 0)
}

export function buildingBlocks(state) {
  return ['oak_log', 'oak_planks', 'cobblestone', 'dirt', 'stone']
    .reduce((sum, item) => sum + countItem(state, item), 0)
}

function rule(validTargets, [min, max], requires) {
  return { validTargets, quantity: { min, max }, requires }
}

function nearby(state, item) {
  return (state.nearby ?? []).includes(item)
}
