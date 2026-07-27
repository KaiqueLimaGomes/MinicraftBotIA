import pathfinderPackage from 'mineflayer-pathfinder'
import { countByName } from '../primitives/inventory.js'
import { gotoCancelable } from '../primitives/navigation.js'
import { digCancelable } from '../primitives/digging.js'
import { waitForInventoryIncrease } from '../primitives/drops.js'

const { GoalNear } = pathfinderPackage.goals

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

function findReachableLog(bot) {
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

  async canExecute({ bot }) {
    if (!bot.pathfinder?.goto) {
      return { ok: false, reason: 'Mineflayer pathfinder is not loaded' }
    }

    const block = findReachableLog(bot)
    if (!block) {
      return { ok: false, reason: 'No diggable supported log within 24 blocks' }
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

  async execute({ bot, context, precondition }) {
    const { x, y, z } = precondition.target
    await gotoCancelable(bot, new GoalNear(x, y, z, 1), context)

    const block = bot.blockAt(precondition.target)
    if (!block || block.name !== precondition.logName) {
      throw new Error('Target log changed before digging')
    }

    await digCancelable(bot, block, context)
    const collected = await waitForInventoryIncrease({
      bot,
      itemName: precondition.logName,
      beforeCount: precondition.logsBefore,
      context
    })

    return { blockBroken: true, collected }
  },

  async verifyProgress({ bot, precondition, execution }) {
    const logsAfter = countByName(bot, precondition.logName)
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
