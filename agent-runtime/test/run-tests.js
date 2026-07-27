import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { EventEmitter } from 'node:events'
import { SkillRunner } from '../runtime/skill-runner.js'
import { createSkillRegistry } from '../runtime/skill-registry.js'
import { craftPlanksSkill } from '../skills/craft-planks.js'
import { craftCraftingTableSkill } from '../skills/craft-crafting-table.js'
import { collectWoodSkill } from '../skills/collect-wood.js'
import { validateExperimentConfig } from '../experiments/experiment-config.js'

function fakeBot(items = []) {
  let inventory = items.map((item) => ({ ...item }))
  const calls = {
    craft: 0,
    pathfinderStop: 0,
    stopDigging: 0,
    clearControlStates: 0
  }

  return Object.assign(new EventEmitter(), {
    calls,
    entity: {
      onGround: true,
      position: {
        distanceTo: () => 3
      }
    },
    version: '1.21.11',
    lookAt: async () => {},
    digTime: () => 3_000,
    registry: {
      itemsByName: {
        oak_planks: { id: 5 }
      }
    },
    inventory: {
      items: () => inventory.map((item) => ({ ...item }))
    },
    recipesFor: () => [{ result: { id: 5, count: 4 } }],
    craft: async () => {
      calls.craft += 1
      const log = inventory.find((item) => item.name === 'oak_log')
      if (log) log.count -= 1
      inventory = inventory.filter((item) => item.count > 0)
      const planks = inventory.find((item) => item.name === 'oak_planks')
      if (planks) planks.count += 4
      else inventory.push({ name: 'oak_planks', count: 4 })
    },
    pathfinder: {
      isMoving: () => true,
      stop: () => { calls.pathfinderStop += 1 }
    },
    stopDigging: () => { calls.stopDigging += 1 },
    clearControlStates: () => { calls.clearControlStates += 1 }
  })
}

function runner({
  skills = [craftPlanksSkill],
  mode = 'limited',
  timeoutMs = 100,
  snapshotProvider = async () => ({ fresh: true })
} = {}) {
  return new SkillRunner({
    registry: createSkillRegistry(skills),
    mode,
    defaultTimeoutMs: timeoutMs,
    snapshotProvider
  })
}

async function test(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

await test('defaults to shadow and does not mutate the world', async () => {
  const previous = process.env.EXECUTION_MODE
  delete process.env.EXECUTION_MODE
  try {
    const bot = fakeBot([{ name: 'oak_log', count: 1 }])
    const subject = new SkillRunner({
      registry: createSkillRegistry(),
      snapshotProvider: async () => ({})
    })
    const result = await subject.run({ bot, action: 'craft_planks' })
    assert.equal(result.code, 'EXECUTION_MODE_REJECTED')
    assert.equal(bot.calls.craft, 0)
  } finally {
    if (previous === undefined) delete process.env.EXECUTION_MODE
    else process.env.EXECUTION_MODE = previous
  }
})

await test('rejects actions outside the limited allowlist', async () => {
  const bot = fakeBot()
  const result = await runner().run({ bot, action: 'fight_zombie' })
  assert.equal(result.code, 'EXECUTION_MODE_REJECTED')
  assert.equal(result.success, false)
})

await test('takes a fresh snapshot immediately before canExecute', async () => {
  const events = []
  const skill = {
    action: 'craft_planks',
    canExecute: async ({ snapshot }) => {
      events.push(`can:${snapshot.version}`)
      return { ok: false, reason: 'stop' }
    },
    execute: async () => events.push('execute'),
    verifyProgress: async () => ({ ok: false })
  }
  const result = await runner({
    skills: [skill],
    snapshotProvider: async () => {
      events.push('snapshot')
      return { version: 2 }
    }
  }).run({ bot: fakeBot(), action: 'craft_planks' })

  assert.equal(result.code, 'CAN_EXECUTE_REJECTED')
  assert.deepEqual(events, ['snapshot', 'can:2'])
})

await test('rejects two simultaneous skills for one bot', async () => {
  let release
  const blocker = new Promise((resolve) => { release = resolve })
  const skill = {
    action: 'craft_planks',
    canExecute: async () => ({ ok: true }),
    execute: async () => blocker,
    verifyProgress: async () => ({ ok: true })
  }
  const subject = runner({ skills: [skill], timeoutMs: 500 })
  const bot = fakeBot()
  const first = subject.run({ bot, action: 'craft_planks' })
  await delay(5)
  const second = await subject.run({ bot, action: 'craft_planks' })
  assert.equal(second.code, 'EXECUTION_BUSY')
  release({})
  await first
})

await test('times out, aborts and stops movement and digging', async () => {
  let observedAbort = false
  const skill = {
    action: 'craft_planks',
    canExecute: async () => ({ ok: true }),
    execute: async ({ context }) => new Promise((resolve) => {
      context.signal.addEventListener('abort', () => {
        observedAbort = true
        resolve({})
      }, { once: true })
    }),
    verifyProgress: async () => ({ ok: true })
  }
  const bot = fakeBot()
  const result = await runner({ skills: [skill], timeoutMs: 20 })
    .run({ bot, action: 'craft_planks' })

  assert.equal(result.code, 'EXECUTION_TIMEOUT')
  assert.equal(observedAbort, true)
  assert.ok(bot.calls.pathfinderStop > 0)
  assert.ok(bot.calls.stopDigging > 0)
  assert.ok(bot.calls.clearControlStates > 0)
})

await test('external abort ends the current execution', async () => {
  const skill = {
    action: 'craft_planks',
    canExecute: async () => ({ ok: true }),
    execute: async () => new Promise(() => {}),
    verifyProgress: async () => ({ ok: true })
  }
  const bot = fakeBot()
  const subject = runner({ skills: [skill], timeoutMs: 500 })
  const pending = subject.run({ bot, action: 'craft_planks' })
  await delay(5)
  assert.equal(subject.abort(bot, 'test_abort'), true)
  const result = await pending
  assert.equal(result.code, 'EXECUTION_ABORTED')
  assert.equal(subject.isRunning(bot), false)
})

await test('does not report success when verification sees no effect', async () => {
  const skill = {
    action: 'craft_planks',
    canExecute: async () => ({ ok: true }),
    execute: async () => ({}),
    verifyProgress: async () => ({
      ok: false,
      reason: 'inventory unchanged'
    })
  }
  const result = await runner({ skills: [skill] })
    .run({ bot: fakeBot(), action: 'craft_planks' })
  assert.equal(result.code, 'VERIFY_PROGRESS_FAILED')
  assert.equal(result.success, false)
})

await test('craft_planks requires a real log and does not hide prerequisites', async () => {
  const bot = fakeBot([{ name: 'oak_planks', count: 4 }])
  const result = await runner().run({ bot, action: 'craft_planks' })
  assert.equal(result.code, 'CAN_EXECUTE_REJECTED')
  assert.equal(bot.calls.craft, 0)
})

await test('craft_planks succeeds only after plank inventory increases', async () => {
  const bot = fakeBot([{ name: 'oak_log', count: 1 }])
  const result = await runner().run({ bot, action: 'craft_planks' })
  assert.equal(result.code, 'SKILL_SUCCEEDED', result.reason)
  assert.equal(result.success, true)
  assert.deepEqual(result.evidence, {
    plankName: 'oak_planks',
    planksBefore: 0,
    planksAfter: 4
  })
})

await test('craft_crafting_table rejects logs without four existing planks', async () => {
  const bot = fakeBot([{ name: 'oak_log', count: 2 }])
  bot.registry.itemsByName.crafting_table = { id: 58 }
  const result = await runner({ skills: [craftCraftingTableSkill] })
    .run({ bot, action: 'craft_crafting_table' })
  assert.equal(result.code, 'CAN_EXECUTE_REJECTED')
  assert.equal(bot.calls.craft, 0)
})

await test('craft_crafting_table verifies a real inventory increase', async () => {
  const bot = fakeBot([{ name: 'oak_planks', count: 4 }])
  bot.registry.itemsByName.crafting_table = { id: 58 }
  bot.craft = async () => {
    bot.calls.craft += 1
    const inventory = bot.inventory.items()
    const planks = inventory.find((item) => item.name === 'oak_planks')
    planks.count -= 4
    inventory.push({ name: 'crafting_table', count: 1 })
    bot.inventory.items = () => inventory
      .filter((item) => item.count > 0)
      .map((item) => ({ ...item }))
  }
  const result = await runner({ skills: [craftCraftingTableSkill] })
    .run({ bot, action: 'craft_crafting_table' })
  assert.equal(result.code, 'SKILL_SUCCEEDED')
  assert.equal(result.evidence.tablesAfter, 1)
  assert.equal(result.evidence.planksAfter, 0)
})

await test('collect_wood rejects execution without pathfinder', async () => {
  const bot = fakeBot()
  delete bot.pathfinder
  const result = await runner({ skills: [collectWoodSkill] })
    .run({ bot, action: 'collect_wood' })
  assert.equal(result.code, 'CAN_EXECUTE_REJECTED')
})

await test('collect_wood succeeds only when the drop reaches inventory', async () => {
  const bot = fakeBot()
  const target = {
    type: 17,
    name: 'oak_log',
    position: {
      x: 2,
      y: 64,
      z: 2,
      offset: () => ({}),
      equals: () => true
    }
  }
  let dug = false
  bot.registry.blocksByName = { oak_log: { id: 17 } }
  bot.findBlocks = () => [target.position]
  bot.blockAt = () => dug ? { type: 0, name: 'air' } : target
  bot.canDigBlock = () => true
  bot.pathfinder.goto = async () => {}
  bot.dig = async () => {
    dug = true
    const items = bot.inventory.items()
    items.push({ name: 'oak_log', count: 1 })
    bot.inventory.items = () => items.map((item) => ({ ...item }))
  }

  const result = await runner({ skills: [collectWoodSkill], timeoutMs: 2_000 })
    .run({ bot, action: 'collect_wood' })
  assert.equal(result.code, 'SKILL_SUCCEEDED', result.reason)
  assert.equal(result.evidence.logsAfter, 1)
})

await test('a late execution cannot replace a timeout result with success', async () => {
  let lateFinished = false
  const skill = {
    action: 'craft_planks',
    canExecute: async () => ({ ok: true }),
    execute: async () => {
      await delay(40)
      lateFinished = true
      return {}
    },
    verifyProgress: async () => ({ ok: true })
  }
  const subject = runner({ skills: [skill], timeoutMs: 10 })
  const result = await subject.run({ bot: fakeBot(), action: 'craft_planks' })
  assert.equal(result.code, 'EXECUTION_TIMEOUT')
  await delay(50)
  assert.equal(lateFinished, true)
  assert.equal(result.success, false)
})

await test('an aborted skill cannot mutate inventory after timeout', async () => {
  const bot = fakeBot()
  const skill = {
    action: 'craft_planks',
    canExecute: async () => ({ ok: true }),
    execute: async ({ context }) => {
      await delay(40)
      if (!context.signal.aborted) {
        bot.inventory.items = () => [{ name: 'oak_planks', count: 4 }]
      }
      return {}
    },
    verifyProgress: async () => ({ ok: true })
  }
  const result = await runner({ skills: [skill], timeoutMs: 10 })
    .run({ bot, action: 'craft_planks' })
  await delay(50)
  assert.equal(result.code, 'EXECUTION_TIMEOUT')
  assert.deepEqual(bot.inventory.items(), [])
})

await test('experiment harness blocks remote RCON by default', async () => {
  assert.deepEqual(validateExperimentConfig({
    rconHost: '192.168.1.10',
    password: 'secret',
    repetitions: 10
  }), {
    ok: false,
    reason: 'REMOTE_RCON_BLOCKED'
  })
})

await test('experiment harness requires a password and bounded repetitions', async () => {
  assert.equal(validateExperimentConfig({
    rconHost: '127.0.0.1',
    password: '',
    repetitions: 10
  }).reason, 'RCON_PASSWORD_REQUIRED')
  assert.equal(validateExperimentConfig({
    rconHost: '127.0.0.1',
    password: 'secret',
    repetitions: 11
  }).reason, 'INVALID_REPETITIONS')
})

console.log('All agent runtime tests passed.')
