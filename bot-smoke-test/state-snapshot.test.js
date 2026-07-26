import assert from 'node:assert/strict'
import { secondsUntilNight, timeName } from './state-snapshot.js'

assert.equal(timeName(0), 'morning')
assert.equal(timeName(13000), 'night')
assert.equal(timeName(23500), 'dawn')
assert.equal(secondsUntilNight(12000), 50)
assert.equal(secondsUntilNight(13000), 0)
assert.equal(secondsUntilNight(22000), 0)
assert.equal(secondsUntilNight(23000), 700)
assert.equal(secondsUntilNight(23900), 655)

console.log('All state snapshot tests passed.')
