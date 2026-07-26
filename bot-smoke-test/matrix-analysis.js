const foods = new Set([
  'raw_beef', 'cooked_beef', 'raw_mutton', 'cooked_mutton',
  'raw_porkchop', 'cooked_porkchop', 'bread', 'apple'
])

export function snapshotMatchesExpectation(snapshot, expected) {
  const failures = []
  compareOneOf(failures, 'time', snapshot.time, expected.time)
  compareEqual(failures, 'shelterStatus', snapshot.shelterStatus, expected.shelterStatus)
  compareEqual(failures, 'baseStatus', snapshot.baseStatus, expected.baseStatus)
  compareEqual(failures, 'hasChest', snapshot.hasChest, expected.hasChest)
  compareEqual(failures, 'hasCraftingTable', snapshot.hasCraftingTable, expected.hasCraftingTable)
  compareEqual(failures, 'inventoryFull', snapshot.inventoryFull, expected.inventoryFull)
  compareEqual(failures, 'threatImmediate', snapshot.threatImmediate, expected.threatImmediate)
  if (expected.inventoryEmpty && Object.keys(snapshot.inventory).length !== 0) failures.push('inventory is not empty')
  if (expected.toolsEmpty && snapshot.tools.length !== 0) failures.push('tools are not empty')
  if (expected.hasBasicTool && !snapshot.tools.some(tool => /_(pickaxe|axe|sword)$/.test(tool))) failures.push('basic tool missing')
  if (expected.hasFood && !Object.keys(snapshot.inventory).some(item => foods.has(item))) failures.push('food missing')
  compareMaximum(failures, 'health', snapshot.health, expected.healthMax)
  compareMaximum(failures, 'hunger', snapshot.hunger, expected.hungerMax)
  includesAll(failures, 'nearby', snapshot.nearby, expected.nearbyIncludes)
  includesAny(failures, 'nearby', snapshot.nearby, expected.nearbyAny)
  includesAll(failures, 'tools', snapshot.tools, expected.toolsInclude)
  inventoryAtLeast(failures, snapshot.inventory, expected.inventoryAtLeast)
  if (expected.buildingBlocksAtLeast !== undefined &&
      buildingBlocks(snapshot.inventory) < expected.buildingBlocksAtLeast) {
    failures.push(`building blocks below ${expected.buildingBlocksAtLeast}`)
  }
  return { matches: failures.length === 0, failures }
}

export function summarizeMatrix(records) {
  const decisions = records.filter(record => record.type === 'shadow_decision')
  const phases = new Set(decisions.map(record => record.matrix?.phase).filter(Boolean))
  return {
    phasesCompleted: phases.size,
    decisions: decisions.length,
    snapshotMatchRate: rate(decisions, row => row.matrix?.snapshotValidation?.matches),
    catalogExecutableRate: rate(decisions, row => row.planner?.validation?.catalogExecutable),
    stillExecutableRate: rate(decisions, row => row.decisionStillExecutable),
    expectedActionRate: rate(decisions, row => row.matrix?.expectedActionMatched),
    criticalCorrectRate: rate(
      decisions.filter(row => [6, 7, 10, 12].includes(row.matrix?.phase)),
      row => row.matrix?.expectedActionMatched
    ),
    sameStateSameDecisionRate: rate(
      decisions.filter(row => row.decisionRelation?.startsWith('same_state')),
      row => row.decisionRelation === 'same_state_same_decision'
    ),
    prematureExploreCount: decisions.filter(row =>
      row.planner?.decision?.action === 'explore_area' && row.matrix?.phase <= 5).length,
    prematureShelterCount: decisions.filter(row =>
      row.planner?.decision?.action === 'build_temporary_shelter' && row.matrix?.phase !== 7).length,
    unhandledErrors: records.filter(row => row.type === 'shadow_error').length,
    p95LatencyMs: percentile(decisions.map(row => row.latencyMs), 0.95)
  }
}

function rate(items, predicate) {
  return items.length ? items.filter(predicate).length / items.length : 0
}

function percentile(values, quantile) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)]
}

function compareEqual(failures, name, actual, expected) {
  if (expected !== undefined && actual !== expected) failures.push(`${name}: expected ${expected}, got ${actual}`)
}

function compareOneOf(failures, name, actual, expected) {
  if (expected && !expected.includes(actual)) failures.push(`${name}: expected one of ${expected}, got ${actual}`)
}

function compareMaximum(failures, name, actual, expected) {
  if (expected !== undefined && actual > expected) failures.push(`${name}: expected <= ${expected}, got ${actual}`)
}

function includesAll(failures, name, actual = [], expected) {
  for (const value of expected ?? []) if (!actual.includes(value)) failures.push(`${name} missing ${value}`)
}

function includesAny(failures, name, actual = [], expected) {
  if (expected && !expected.some(value => actual.includes(value))) failures.push(`${name} missing any of ${expected}`)
}

function inventoryAtLeast(failures, inventory, expected) {
  for (const [item, quantity] of Object.entries(expected ?? {})) {
    if (Number(inventory[item] ?? 0) < quantity) failures.push(`${item}: expected >= ${quantity}`)
  }
}

function buildingBlocks(inventory) {
  return ['oak_log', 'oak_planks', 'cobblestone', 'dirt', 'stone']
    .reduce((sum, item) => sum + Number(inventory[item] ?? 0), 0)
}
