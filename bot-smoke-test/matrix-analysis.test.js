import assert from 'node:assert/strict'
import { snapshotMatchesExpectation, summarizeMatrix } from './matrix-analysis.js'

const snapshot = {
  time: 'morning',
  health: 20,
  hunger: 20,
  inventory: {},
  inventoryFull: false,
  nearby: ['oak_tree'],
  shelterStatus: 'unknown',
  baseStatus: 'unknown',
  hasCraftingTable: false,
  hasChest: false,
  threatImmediate: false,
  tools: []
}
assert.equal(snapshotMatchesExpectation(snapshot, {
  time: ['morning', 'day'], inventoryEmpty: true, nearbyIncludes: ['oak_tree']
}).matches, true)
assert.equal(snapshotMatchesExpectation(snapshot, {
  nearbyIncludes: ['iron_ore']
}).matches, false)

const records = [1, 2, 3].map(() => ({
  type: 'shadow_decision',
  latencyMs: 800,
  decisionStillExecutable: true,
  decisionRelation: 'same_state_same_decision',
  planner: {
    decision: { action: 'collect_wood' },
    validation: { catalogExecutable: true }
  },
  matrix: {
    phase: 1,
    expectedActionMatched: true,
    snapshotValidation: { matches: true }
  }
}))
const summary = summarizeMatrix(records)
assert.equal(summary.phasesCompleted, 1)
assert.equal(summary.snapshotMatchRate, 1)
assert.equal(summary.catalogExecutableRate, 1)
assert.equal(summary.coldStartMaxMs, 0)
assert.equal(summary.warmP95LatencyMs, 800)
assert.equal(summary.criticalCorrectRate, null)

console.log('All matrix analysis tests passed.')
