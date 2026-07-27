import assert from 'node:assert/strict'
import { admissibleActions, executableActions, normalizeState } from './action-catalog.js'
import { createPlanner } from './planner.js'
import { assessQuality } from './quality-policy.js'
import { admissibleActionSpecs, executableActionSpecs } from './resolve-intent.js'

const json = value => JSON.stringify(value)
const base = {
  time: 'morning', health: 20, hunger: 20, inventory: {}, nearby: ['oak_tree'],
  tools: [], hasCraftingTable: false, baseKnown: false
}

await test('accepts valid normalized alias', async () => {
  const planner = createPlanner({ generate: async () => json({
    goal: 'survive', action: 'collect_wood', target: 'tree', quantity: 8, priority: 8, reason: 'Need wood'
  }) })
  const output = await planner.decide(base)
  assert.equal(output.source, 'llm')
  assert.equal(output.decision.target, 'oak_tree')
  assert.equal(output.validation.executable, true)
})

await test('repairs an impossible decision once', async () => {
  const replies = [
    json({ goal: 'survive', action: 'mine_iron', target: 'iron_ore', quantity: 4, priority: 8, reason: 'Iron' }),
    json({ goal: 'survive', action: 'collect_wood', target: 'oak_tree', quantity: 8, priority: 8, reason: 'Need wood' })
  ]
  const planner = createPlanner({ generate: async () => replies.shift() })
  const output = await planner.decide(base)
  assert.equal(output.source, 'llm_repair')
  assert.equal(output.attempts, 2)
  assert.equal(output.validation.executable, true)
})

await test('uses fallback after one failed repair', async () => {
  const planner = createPlanner({ generate: async () => 'not json' })
  const output = await planner.decide(base)
  assert.equal(output.source, 'fallback')
  assert.equal(output.decision.action, 'collect_wood')
  assert.equal(output.attempts, 2)
  assert.equal(output.validation.executable, true)
})

await test('safety overrides without calling the LLM', async () => {
  let calls = 0
  const planner = createPlanner({ generate: async () => { calls++; return '{}' } })
  const output = await planner.decide({ ...base, health: 5, threatImmediate: true, nearby: ['zombie'] })
  assert.equal(output.source, 'safety_override')
  assert.equal(output.decision.action, 'flee_threat')
  assert.equal(output.attempts, 0)
  assert.equal(calls, 0)
})

await test('critical hunger overrides with available food', async () => {
  const planner = createPlanner({ generate: async () => '{}' })
  const output = await planner.decide({ ...base, hunger: 4, inventory: { raw_beef: 2 }, nearby: ['stone'] })
  assert.equal(output.decision.action, 'eat_food')
  assert.equal(output.validation.executable, true)
})

await test('marks executable but weaker decisions as suboptimal', async () => {
  const quality = assessQuality({ action: 'explore_area' }, normalizeState(base))
  assert.equal(quality.status, 'VALID_SUBOPTIMAL')
})

await test('does not offer exploration before basic progression', async () => {
  const state = normalizeState(base)
  assert.equal(executableActions(state).includes('explore_area'), true)
  assert.equal(admissibleActions(state).includes('explore_area'), false)
})

await test('unknown shelter does not authorize building', async () => {
  const state = normalizeState({
    time: 'dusk', timeUntilNightSeconds: 60, shelterStatus: 'unknown',
    inventory: { oak_log: 12 }, nearby: ['stone']
  })
  assert.equal(executableActions(state).includes('build_temporary_shelter'), false)
})

await test('known absent shelter is admissible only near night', async () => {
  const morning = normalizeState({
    time: 'morning', timeUntilNightSeconds: 500, shelterStatus: 'absent',
    inventory: { oak_log: 12 }, nearby: ['stone']
  })
  const dusk = normalizeState({ ...morning, time: 'dusk', timeUntilNightSeconds: 60 })
  assert.equal(admissibleActions(morning).includes('build_temporary_shelter'), false)
  assert.equal(admissibleActions(dusk).includes('build_temporary_shelter'), true)
})

await test('known base enables return and storage', async () => {
  const state = normalizeState({
    baseStatus: 'known', base: { position: { x: 1, y: 64, z: 1 } },
    hasChest: true, inventoryFull: true
  })
  assert.equal(executableActions(state).includes('return_to_base'), true)
  assert.equal(executableActions(state).includes('store_items'), true)
})

await test('repair specs preserve strategic admissibility', async () => {
  const state = normalizeState(base)
  assert.equal(executableActionSpecs(state).some(spec => spec.action === 'explore_area'), true)
  assert.equal(admissibleActionSpecs(state).some(spec => spec.action === 'explore_area'), false)
})

await test('does not offer redundant wood collection after eight logs', async () => {
  const state = normalizeState({
    inventory: { oak_log: 8 },
    nearby: ['oak_tree']
  })
  assert.equal(admissibleActions(state).includes('collect_wood'), false)
  assert.equal(admissibleActions(state).includes('craft_planks'), true)
})

await test('does not offer wood collection when planks unlock the table', async () => {
  const state = normalizeState({
    inventory: { oak_planks: 4 },
    nearby: ['oak_tree']
  })
  assert.equal(admissibleActions(state).includes('collect_wood'), false)
  assert.equal(admissibleActions(state).includes('craft_crafting_table'), true)
})

await test('does not hide plank crafting inside crafting table action', async () => {
  const logsOnly = normalizeState({ inventory: { oak_log: 8 } })
  const planksReady = normalizeState({ inventory: { oak_planks: 4 } })
  assert.equal(executableActions(logsOnly).includes('craft_crafting_table'), false)
  assert.equal(executableActions(logsOnly).includes('craft_planks'), true)
  assert.equal(executableActions(planksReady).includes('craft_crafting_table'), true)
})

await test('food collection overrides resource progression at hunger fourteen', async () => {
  const state = normalizeState({
    hunger: 14,
    inventory: { wooden_pickaxe: 1 },
    tools: ['wooden_pickaxe'],
    nearby: ['cow', 'oak_tree', 'stone']
  })
  assert.deepEqual(admissibleActions(state), ['collect_food'])
})

await test('eating inventory food overrides collection at hunger fourteen', async () => {
  const state = normalizeState({
    hunger: 14,
    inventory: { raw_beef: 1 },
    nearby: ['cow', 'oak_tree']
  })
  assert.deepEqual(admissibleActions(state), ['eat_food'])
})

await test('recognizes real 1.21.11 beef item id as food', async () => {
  const state = normalizeState({
    hunger: 4,
    inventory: { beef: 2 },
    nearby: ['stone']
  })
  assert.deepEqual(admissibleActions(state), ['eat_food'])
})

await test('visible ores with stone pickaxe override generic wood collection', async () => {
  const state = normalizeState({
    hunger: 20,
    inventory: { stone_pickaxe: 1 },
    tools: ['stone_pickaxe'],
    nearby: ['coal_ore', 'iron_ore', 'oak_tree', 'stone'],
    shelterStatus: 'present'
  })
  assert.deepEqual(admissibleActions(state), ['mine_coal', 'mine_iron'])
})

console.log('All planner tests passed.')

async function test(name, fn) {
  await fn()
  console.log(`PASS ${name}`)
}
