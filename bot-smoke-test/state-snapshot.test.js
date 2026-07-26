import assert from 'node:assert/strict'
import {
  createStateSnapshot,
  secondsUntilNight,
  snapshotDecisionFingerprint,
  timeName
} from './state-snapshot.js'

assert.equal(timeName(0), 'morning')
assert.equal(timeName(13000), 'night')
assert.equal(timeName(23500), 'dawn')
assert.equal(secondsUntilNight(12000), 50)
assert.equal(secondsUntilNight(13000), 0)
assert.equal(secondsUntilNight(22000), 0)
assert.equal(secondsUntilNight(23000), 700)
assert.equal(secondsUntilNight(23900), 655)

const bot = {
  inventory: { items: () => [] },
  entities: {},
  entity: { position: position(0, 64, 0) },
  time: { timeOfDay: 1000, age: 1 },
  health: 20,
  food: 20,
  registry: { blocksByName: {} },
  findBlock: () => null
}
const withBase = createStateSnapshot(bot, {
  shelterStatus: 'unknown',
  base: {
    position: { x: 10, y: 64, z: -5 },
    hasChest: true,
    hasCraftingTable: true
  }
})
assert.equal(withBase.baseStatus, 'known')
assert.equal(withBase.hasChest, true)
assert.equal(withBase.hasCraftingTable, true)

const day = { ...withBase, time: 'day', timeUntilNightSeconds: 250 }
const dusk = { ...withBase, time: 'dusk', timeUntilNightSeconds: 120 }
assert.notEqual(snapshotDecisionFingerprint(day), snapshotDecisionFingerprint(dusk))

console.log('All state snapshot tests passed.')

function position(x, y, z) {
  return {
    x, y, z,
    toFixed: digits => Number(x).toFixed(digits),
    distanceTo: other => Math.hypot(x - other.x, y - other.y, z - other.z)
  }
}
