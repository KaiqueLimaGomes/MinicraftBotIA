import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import vec3Package from 'vec3'
import {
  findNewDrops,
  snapshotItemEntityIds,
  trackAndCollectDrop
} from '../primitives/drops.js'

const { Vec3 } = vec3Package
const origin = new Vec3(0, 64, 0)

function entity(id, x, y = 64, z = 0, itemName = 'oak_log') {
  return {
    id,
    name: 'item',
    position: new Vec3(x, y, z),
    getDroppedItem: () => ({ name: itemName })
  }
}

function fixture({
  entities = {},
  inventory = 0,
  onGoto = async () => {}
} = {}) {
  const emitter = new EventEmitter()
  let oakLogs = inventory
  let moving = false
  let rejectGoto = null
  const bot = Object.assign(emitter, {
    entities,
    inventory: {
      items: () => oakLogs > 0
        ? [{ name: 'oak_log', count: oakLogs }]
        : []
    },
    pathfinder: {
      goto: async (goal) => {
        moving = true
        return new Promise((resolve, reject) => {
          rejectGoto = reject
          Promise.resolve(onGoto({
            goal,
            bot,
            addLog: () => { oakLogs += 1 },
            resolve,
            reject
          })).then(resolve, reject)
        }).finally(() => {
          moving = false
          rejectGoto = null
        })
      },
      isMoving: () => moving,
      stop: () => rejectGoto?.(new Error('stopped'))
    },
    clearControlStates: () => {}
  })
  return {
    bot,
    addLog: () => { oakLogs += 1 },
    count: () => oakLogs
  }
}

function context() {
  const controller = new AbortController()
  return {
    controller,
    value: {
      signal: controller.signal,
      assertActive: () => {
        if (controller.signal.aborted) {
          const error = new Error('aborted')
          error.code = 'EXECUTION_ABORTED'
          throw error
        }
      }
    }
  }
}

async function runTest(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

await runTest('existing item entity is ignored', async () => {
  const oldDrop = entity(1, 0.1)
  const newDrop = entity(2, 1)
  const bot = fixture({ entities: { 1: oldDrop, 2: newDrop } }).bot
  const ids = new Set([1])
  assert.deepEqual(findNewDrops({
    bot,
    existingEntityIds: ids,
    origin,
    radius: 8
  }).map((drop) => drop.id), [2])
})

await runTest('new item wins even when an old item is closer', async () => {
  const bot = fixture({
    entities: {
      1: entity(1, 0.1),
      2: entity(2, 2)
    }
  }).bot
  const found = findNewDrops({
    bot,
    existingEntityIds: new Set([1]),
    origin,
    radius: 8
  })
  assert.equal(found[0].id, 2)
})

await runTest('multiple new drops are sorted by broken block origin', async () => {
  const bot = fixture({
    entities: {
      3: entity(3, 5),
      4: entity(4, 1),
      5: entity(5, 3)
    }
  }).bot
  const found = findNewDrops({
    bot,
    existingEntityIds: new Set(),
    origin,
    radius: 8
  })
  assert.deepEqual(found.map((drop) => drop.id), [4, 5, 3])
})

await runTest('expected item type wins over a closer unrelated drop', async () => {
  const bot = fixture({
    entities: {
      30: entity(30, 0.5, 64, 0, 'stick'),
      31: entity(31, 2, 64, 0, 'oak_log')
    }
  }).bot
  const found = findNewDrops({
    bot,
    existingEntityIds: new Set(),
    origin,
    radius: 8,
    expectedItemName: 'oak_log'
  })
  assert.deepEqual(found.map((drop) => drop.id), [31, 30])
})

await runTest('disappearing first candidate falls back to the second', async () => {
  const first = entity(32, 1)
  const second = entity(33, 2)
  let calls = 0
  const state = fixture({
    entities: { 32: first, 33: second },
    onGoto: async ({ bot, addLog }) => {
      calls += 1
      if (calls === 1) delete bot.entities[32]
      else addLog()
    }
  })
  const result = await trackAndCollectDrop({
    bot: state.bot,
    context: context().value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0
  })
  assert.equal(result.code, 'DROP_COLLECTED')
  assert.equal(result.selectedDropId, 33)
  assert.equal(result.pathAttempts, 2)
})

await runTest('new nearby drop is selected and collected', async () => {
  const drop = entity(8, 2)
  const state = fixture({
    entities: { 8: drop },
    onGoto: async ({ addLog }) => addLog()
  })
  const ctx = context()
  const result = await trackAndCollectDrop({
    bot: state.bot,
    context: ctx.value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0
  })
  assert.equal(result.code, 'DROP_COLLECTED')
  assert.equal(result.selectedDropId, 8)
  assert.equal(result.pathAttempts, 1)
})

await runTest('moving item is targeted again at its new block', async () => {
  const drop = entity(9, 2)
  const targets = []
  let attempt = 0
  const state = fixture({
    entities: { 9: drop },
    onGoto: async ({ goal, addLog }) => {
      targets.push([goal.x, goal.y, goal.z])
      attempt += 1
      if (attempt === 1) drop.position = new Vec3(4, 64, 0)
      else addLog()
    }
  })
  const result = await trackAndCollectDrop({
    bot: state.bot,
    context: context().value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0,
    maxPathAttempts: 3
  })
  assert.equal(result.code, 'DROP_COLLECTED')
  assert.deepEqual(targets, [[2, 64, 0], [4, 64, 0]])
})

await runTest('entity disappearance with inventory increase is success', async () => {
  const drop = entity(10, 2)
  const state = fixture({
    entities: { 10: drop },
    onGoto: async ({ bot, addLog }) => {
      delete bot.entities[10]
      addLog()
    }
  })
  const result = await trackAndCollectDrop({
    bot: state.bot,
    context: context().value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0
  })
  assert.equal(result.code, 'DROP_COLLECTED')
})

await runTest('entity disappearance without inventory increase is failure', async () => {
  const drop = entity(11, 2)
  const state = fixture({
    entities: { 11: drop },
    onGoto: async ({ bot }) => { delete bot.entities[11] }
  })
  const result = await trackAndCollectDrop({
    bot: state.bot,
    context: context().value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0
  })
  assert.equal(result.code, 'DROP_DISAPPEARED')
  assert.equal(result.collected, false)
})

await runTest('second navigation can recover after first failure', async () => {
  const drop = entity(12, 2)
  let calls = 0
  const state = fixture({
    entities: { 12: drop },
    onGoto: async ({ addLog }) => {
      calls += 1
      if (calls === 1) throw new Error('temporary path failure')
      addLog()
    }
  })
  const result = await trackAndCollectDrop({
    bot: state.bot,
    context: context().value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0
  })
  assert.equal(result.code, 'DROP_COLLECTED')
  assert.equal(result.pathAttempts, 2)
})

await runTest('inventory increase before navigation succeeds immediately', async () => {
  const state = fixture({ inventory: 1 })
  const result = await trackAndCollectDrop({
    bot: state.bot,
    context: context().value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set()
  })
  assert.equal(result.code, 'DROP_COLLECTED')
  assert.equal(result.pathAttempts, 0)
})

await runTest('abort stops pathfinder and returns DROP_ABORTED', async () => {
  const drop = entity(13, 2)
  const state = fixture({
    entities: { 13: drop },
    onGoto: async () => new Promise(() => {})
  })
  const ctx = context()
  const pending = trackAndCollectDrop({
    bot: state.bot,
    context: ctx.value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0
  })
  await delay(10)
  ctx.controller.abort('test')
  const result = await pending
  assert.equal(result.code, 'DROP_ABORTED')
  assert.equal(state.bot.pathfinder.isMoving(), false)
})

await runTest('stale aborted tracking does not start another path attempt', async () => {
  const drop = entity(14, 2)
  let calls = 0
  const state = fixture({
    entities: { 14: drop },
    onGoto: async () => {
      calls += 1
      return new Promise(() => {})
    }
  })
  const ctx = context()
  const pending = trackAndCollectDrop({
    bot: state.bot,
    context: ctx.value,
    itemName: 'oak_log',
    origin,
    beforeCount: 0,
    existingEntityIds: new Set(),
    spawnTimeoutMs: 10,
    settleMs: 0
  })
  await delay(10)
  ctx.controller.abort('stale')
  await pending
  await delay(20)
  assert.equal(calls, 1)
})

await runTest('snapshot captures only item entity ids', async () => {
  const bot = fixture({
    entities: {
      20: entity(20, 1),
      21: { id: 21, name: 'zombie', position: new Vec3(1, 64, 0) }
    }
  }).bot
  assert.deepEqual([...snapshotItemEntityIds(bot)], [20])
})

console.log('All drop tracking tests passed.')
