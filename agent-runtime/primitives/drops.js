import { countByName } from './inventory.js'
import { setTimeout as delay } from 'node:timers/promises'
import pathfinderPackage from 'mineflayer-pathfinder'
import { gotoCancelable } from './navigation.js'

const { GoalBlock } = pathfinderPackage.goals

export function verifyCollectedItem(bot, itemName, beforeCount) {
  return countByName(bot, itemName) > beforeCount
}

export function snapshotItemEntityIds(bot) {
  return new Set(Object.values(bot.entities ?? {})
    .filter((entity) => entity.name === 'item')
    .map((entity) => entity.id))
}

export function findNewDrops({
  bot,
  existingEntityIds,
  origin,
  radius
}) {
  return Object.values(bot.entities ?? {})
    .filter((entity) =>
      entity.name === 'item' &&
      !existingEntityIds.has(entity.id) &&
      entity.position.distanceTo(origin) <= radius
    )
    .sort((a, b) =>
      a.position.distanceTo(origin) -
      b.position.distanceTo(origin)
    )
}

function plainPosition(position) {
  if (!position) return null
  return {
    x: Number(position.x.toFixed(2)),
    y: Number(position.y.toFixed(2)),
    z: Number(position.z.toFixed(2))
  }
}

function inventoryDelta(bot, itemName, beforeCount) {
  return countByName(bot, itemName) - beforeCount
}

export async function trackAndCollectDrop({
  bot,
  context,
  itemName,
  origin,
  beforeCount,
  existingEntityIds,
  preObservedDrops = [],
  spawnTimeoutMs = 4_000,
  settleMs = 600,
  collectionTimeoutMs = 8_000,
  searchRadius = 8,
  maxPathAttempts = 3
}) {
  const startedAt = Date.now()
  const deadline = startedAt + collectionTimeoutMs
  const telemetry = {
    collected: false,
    code: null,
    dropsObserved: 0,
    candidateDropIds: [],
    selectedDropId: null,
    spawnDelayMs: null,
    pathAttempts: 0,
    initialDropPosition: null,
    finalDropPosition: null,
    dropDisappeared: false,
    inventoryDelta: 0
  }
  let candidates = preObservedDrops
    .filter((entity) =>
      entity.name === 'item' &&
      !existingEntityIds.has(entity.id) &&
      entity.position.distanceTo(origin) <= searchRadius
    )
    .sort((a, b) =>
      a.position.distanceTo(origin) -
      b.position.distanceTo(origin)
    )
  telemetry.dropsObserved = candidates.length
  telemetry.candidateDropIds = candidates.map((entity) => entity.id)
  if (candidates[0]) {
    telemetry.selectedDropId = candidates[0].id
    telemetry.spawnDelayMs = 0
    telemetry.initialDropPosition = plainPosition(candidates[0].position)
  }

  const finish = (code, extra = {}) => {
    telemetry.inventoryDelta = inventoryDelta(bot, itemName, beforeCount)
    telemetry.collected = telemetry.inventoryDelta > 0
    telemetry.code = telemetry.collected ? 'DROP_COLLECTED' : code
    return { ...telemetry, ...extra }
  }

  try {
    if (inventoryDelta(bot, itemName, beforeCount) > 0) {
      return finish('DROP_COLLECTED')
    }

    const spawnDeadline = Math.min(deadline, startedAt + spawnTimeoutMs)
    while (candidates.length === 0 && Date.now() < spawnDeadline) {
      context.assertActive()
      if (inventoryDelta(bot, itemName, beforeCount) > 0) {
        return finish('DROP_COLLECTED')
      }
      candidates = findNewDrops({
        bot,
        existingEntityIds,
        origin,
        radius: searchRadius
      })
      if (candidates.length > 0) break
      await delay(50, undefined, { signal: context.signal })
    }

    telemetry.dropsObserved = candidates.length
    telemetry.candidateDropIds = candidates.map((entity) => entity.id)
    const selected = candidates[0]
    if (!selected) return finish('DROP_NOT_OBSERVED')

    telemetry.selectedDropId ??= selected.id
    telemetry.spawnDelayMs ??= Date.now() - startedAt
    telemetry.initialDropPosition ??= plainPosition(selected.position)
    await delay(settleMs, undefined, { signal: context.signal })

    while (
      Date.now() < deadline &&
      telemetry.pathAttempts < maxPathAttempts
    ) {
      context.assertActive()
      if (inventoryDelta(bot, itemName, beforeCount) > 0) {
        return finish('DROP_COLLECTED', {
          finalDropPosition: plainPosition(
            bot.entities?.[selected.id]?.position ?? selected.position
          )
        })
      }

      const currentDrop = bot.entities?.[selected.id]
      if (!currentDrop) {
        telemetry.dropDisappeared = true
        await delay(250, undefined, { signal: context.signal })
        return finish('DROP_DISAPPEARED')
      }

      telemetry.pathAttempts += 1
      const target = currentDrop.position.floored()
      try {
        await gotoCancelable(
          bot,
          new GoalBlock(target.x, target.y, target.z),
          context
        )
      } catch (error) {
        context.assertActive()
        if (telemetry.pathAttempts >= maxPathAttempts) {
          return finish('DROP_UNREACHABLE', { reason: error.message })
        }
      }

      await delay(400, undefined, { signal: context.signal })
      telemetry.finalDropPosition = plainPosition(
        bot.entities?.[selected.id]?.position ?? currentDrop.position
      )
    }

    return finish('DROP_COLLECTION_TIMEOUT')
  } catch (error) {
    if (context.signal.aborted || error.name === 'AbortError') {
      return finish('DROP_ABORTED')
    }
    throw error
  }
}
