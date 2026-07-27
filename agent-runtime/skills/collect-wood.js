import pathfinderPackage from 'mineflayer-pathfinder'
import vec3Package from 'vec3'
import { countByName } from '../primitives/inventory.js'
import { gotoCancelable } from '../primitives/navigation.js'
import {
  digCancelable,
  waitUntilGrounded
} from '../primitives/digging.js'
import { waitForInventoryIncrease } from '../primitives/drops.js'

const { GoalNear } = pathfinderPackage.goals
const { Vec3 } = vec3Package

const SUPPORTED_LOGS = [
  'oak_log',
  'spruce_log',
  'birch_log',
  'jungle_log',
  'acacia_log',
  'dark_oak_log',
  'mangrove_log',
  'cherry_log',
  'pale_oak_log',
  'crimson_stem',
  'warped_stem'
]

function findReachableLog(bot, requestedTarget) {
  if (requestedTarget) {
    const block = bot.blockAt(new Vec3(
      requestedTarget.x,
      requestedTarget.y,
      requestedTarget.z
    ))
    const supported = block && SUPPORTED_LOGS.includes(block.name)
    return supported ? block : null
  }

  const ids = SUPPORTED_LOGS
    .map((name) => bot.registry?.blocksByName?.[name]?.id)
    .filter(Number.isInteger)
  if (ids.length === 0 || !bot.findBlocks) return null

  const positions = bot.findBlocks({
    matching: ids,
    maxDistance: 24,
    count: 16
  })

  for (const position of positions) {
    const block = bot.blockAt(position)
    if (block && bot.canDigBlock?.(block)) return block
  }
  return null
}

export const collectWoodSkill = {
  action: 'collect_wood',

  async canExecute({ bot, params }) {
    if (!bot.pathfinder?.goto) {
      return { ok: false, reason: 'Mineflayer pathfinder is not loaded' }
    }

    const block = findReachableLog(bot, params.target)
    if (!block) {
      return { ok: false, reason: 'No diggable supported log within 24 blocks' }
    }
    const distance = bot.entity.position.distanceTo(block.position)
    const reachableAfterNavigation = params.target &&
      distance > 4.5 &&
      block.diggable === true
    if (!bot.canDigBlock?.(block) && !reachableAfterNavigation) {
      return {
        ok: false,
        reason: JSON.stringify({
          code: 'TARGET_NOT_DIGGABLE',
          block: block.name,
          diggable: block.diggable,
          distance,
          onGround: bot.entity.onGround
        })
      }
    }

    return {
      ok: true,
      logName: block.name,
      target: {
        x: block.position.x,
        y: block.position.y,
        z: block.position.z
      },
      logsBefore: countByName(bot, block.name)
    }
  },

  async execute({ bot, params, context, precondition }) {
    const { x, y, z } = precondition.target
    const distance = bot.entity.position.distanceTo(precondition.target)
    if (distance > 4.5) {
      await gotoCancelable(bot, new GoalNear(x, y, z, 1), context)
    }

    const grounded = await waitUntilGrounded(bot, {
      stableMs: 500,
      timeoutMs: 3_000,
      signal: context.signal
    })
    if (!grounded) {
      const error = new Error('Bot did not remain grounded before digging')
      error.code = 'DIG_NOT_GROUNDED'
      throw error
    }

    const block = bot.blockAt(new Vec3(x, y, z))
    if (!block || block.name !== precondition.logName) {
      throw new Error('Target log changed before digging')
    }

    const digAttempt = await digCancelable(bot, block, context, {
      serverVersion: params.serverVersion,
      attemptNumber: params.attemptNumber,
      recordAttempt: params.recordDigAttempt
    })
    const postDigVerificationMs = Number(params.postDigVerificationMs ?? 500)
    await new Promise((resolve) => setTimeout(resolve, postDigVerificationMs))
    context.assertActive()
    const blockAfterDig = bot.blockAt(new Vec3(x, y, z))
    if (blockAfterDig?.type !== 0) {
      throw new Error('Server still reports the target block after digging')
    }

    let collected = await waitForInventoryIncrease({
      bot,
      itemName: precondition.logName,
      beforeCount: precondition.logsBefore,
      context,
      timeoutMs: 500
    })
    if (!collected) {
      const dropDistance = bot.entity.position.distanceTo(precondition.target)
      if (dropDistance > 1) {
        await gotoCancelable(bot, new GoalNear(x, y, z, 1), context)
      }
      collected = await waitForInventoryIncrease({
        bot,
        itemName: precondition.logName,
        beforeCount: precondition.logsBefore,
        context
      })
    }

    return { blockBroken: true, collected, digAttempt }
  },

  async verifyProgress({ bot, precondition, execution }) {
    const logsAfter = countByName(bot, precondition.logName)
    if (execution?.digAttempt) {
      execution.digAttempt.inventoryDelta[precondition.logName] =
        logsAfter - precondition.logsBefore
      execution.digAttempt.inventoryVerifiedAt =
        new Date().toISOString()
    }
    const ok = execution?.collected === true &&
      logsAfter > precondition.logsBefore
    return {
      ok,
      reason: ok
        ? null
        : 'Log was not confirmed in inventory after digging',
      evidence: {
        logName: precondition.logName,
        logsBefore: precondition.logsBefore,
        logsAfter,
        target: precondition.target
      }
    }
  }
}
