import assert from 'node:assert/strict'
import { createPlanner } from './planner.js'

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
  const planner = createPlanner({ generate: async () => json({
    goal: 'survive', action: 'explore_area', target: 'nearby_area', quantity: 0, priority: 5, reason: 'Explore'
  }) })
  const output = await planner.decide(base)
  assert.equal(output.validation.classification, 'VALID_SUBOPTIMAL')
  assert.equal(output.validation.executable, true)
  assert.equal(output.attempts, 1)
})

console.log('All planner tests passed.')

async function test(name, fn) {
  await fn()
  console.log(`PASS ${name}`)
}
