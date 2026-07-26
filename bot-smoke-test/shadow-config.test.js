import assert from 'node:assert/strict'
import { registeredBaseFromEnv } from './shadow-config.js'

assert.equal(registeredBaseFromEnv({}), null)
assert.deepEqual(registeredBaseFromEnv({
  BASE_X: '10', BASE_Y: '64', BASE_Z: '-5',
  BASE_HAS_CHEST: 'true', BASE_HAS_CRAFTING_TABLE: 'true'
}), {
  position: { x: 10, y: 64, z: -5 },
  hasChest: true,
  hasCraftingTable: true
})
assert.deepEqual(registeredBaseFromEnv({
  BASE_X: '0', BASE_Y: '-64', BASE_Z: '0'
}), {
  position: { x: 0, y: -64, z: 0 },
  hasChest: false,
  hasCraftingTable: false
})
assert.throws(
  () => registeredBaseFromEnv({ BASE_X: '1', BASE_Y: '2' }),
  /must all be provided/
)
assert.throws(
  () => registeredBaseFromEnv({ BASE_X: 'abc', BASE_Y: '64', BASE_Z: '0' }),
  /must be valid numbers/
)

console.log('All shadow config tests passed.')
