import { countByName } from './inventory.js'
import { setTimeout as delay } from 'node:timers/promises'

export function verifyCollectedItem(bot, itemName, beforeCount) {
  return countByName(bot, itemName) > beforeCount
}

export async function waitForInventoryIncrease({
  bot,
  itemName,
  beforeCount,
  context,
  timeoutMs = 5_000,
  pollMs = 100
}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    context.assertActive()
    if (verifyCollectedItem(bot, itemName, beforeCount)) return true
    await delay(pollMs, undefined, { signal: context.signal })
  }
  return verifyCollectedItem(bot, itemName, beforeCount)
}
