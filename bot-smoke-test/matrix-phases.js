export const matrixPhases = {
  1: phase('Morning, empty inventory, oak nearby', ['collect_wood'], {
    time: ['morning', 'day'], inventoryEmpty: true, nearbyIncludes: ['oak_tree']
  }),
  2: phase('Eight logs in inventory', ['craft_planks'], {
    inventoryAtLeast: { oak_log: 8 }
  }),
  3: phase('Planks available, no crafting table', ['craft_crafting_table'], {
    inventoryAtLeast: { oak_planks: 4 }, hasCraftingTable: false
  }),
  4: phase('Crafting table available, no tool', ['craft_tool'], {
    hasCraftingTable: true, toolsEmpty: true
  }),
  5: phase('Basic tool ready and animal nearby', ['collect_food'], {
    hasBasicTool: true, hungerMax: 14, nearbyAny: ['cow', 'sheep', 'pig', 'chicken']
  }),
  6: phase('Critical hunger with food in inventory', ['eat_food'], {
    hungerMax: 6, hasFood: true
  }),
  7: phase('Dusk, twelve blocks, shelter absent', ['build_temporary_shelter'], {
    time: ['dusk', 'night'], shelterStatus: 'absent', buildingBlocksAtLeast: 12
  }),
  8: phase('Inside identified shelter', ['wait', 'mine_coal', 'mine_iron'], {
    shelterStatus: 'present', toolsInclude: ['stone_pickaxe']
  }),
  9: phase('Registered base with chest', ['wait', 'collect_wood', 'store_items', 'return_to_base'], {
    baseStatus: 'known', hasChest: true, atBase: true
  }),
  10: phase('Full inventory with registered base', ['store_items', 'return_to_base'], {
    inventoryFull: true, baseStatus: 'known', atBase: false
  }),
  11: phase('Coal and iron nearby with stone pickaxe', ['mine_coal', 'mine_iron'], {
    nearbyIncludes: ['coal_ore', 'iron_ore'], toolsInclude: ['stone_pickaxe']
  }),
  12: phase('Low health with immediate zombie threat', ['flee_threat'], {
    healthMax: 10, threatImmediate: true, nearbyIncludes: ['zombie']
  })
}

export function getMatrixPhase(value) {
  const number = Number(value)
  if (!Number.isInteger(number) || !matrixPhases[number]) {
    throw new Error('SHADOW_PHASE must be an integer from 1 to 12')
  }
  return { number, ...matrixPhases[number] }
}

function phase(description, expectedActions, expectedSnapshot) {
  return { description, expectedActions, expectedSnapshot }
}
