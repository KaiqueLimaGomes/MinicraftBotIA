import {
  countPlanks,
  findCraftableLog
} from '../primitives/inventory.js'
import { craftRecipe } from '../primitives/crafting.js'

const LOG_TO_PLANKS = {
  oak_log: 'oak_planks',
  spruce_log: 'spruce_planks',
  birch_log: 'birch_planks',
  jungle_log: 'jungle_planks',
  acacia_log: 'acacia_planks',
  dark_oak_log: 'dark_oak_planks',
  mangrove_log: 'mangrove_planks',
  cherry_log: 'cherry_planks',
  pale_oak_log: 'pale_oak_planks',
  crimson_stem: 'crimson_planks',
  warped_stem: 'warped_planks'
}

function resolveRecipe(bot, plankName) {
  const plank = bot.registry?.itemsByName?.[plankName]
  if (!plank) return null
  return bot.recipesFor?.(plank.id, null, 1, null)?.[0] ?? null
}

export const craftPlanksSkill = {
  action: 'craft_planks',

  async canExecute({ bot }) {
    const log = findCraftableLog(bot)
    if (!log) {
      return { ok: false, reason: 'At least one real log or stem is required' }
    }

    const plankName = LOG_TO_PLANKS[log.name]
    if (!plankName) {
      return { ok: false, reason: `Unsupported log type: ${log.name}` }
    }

    const recipe = resolveRecipe(bot, plankName)
    if (!recipe) {
      return { ok: false, reason: `No inventory recipe for ${plankName}` }
    }

    return {
      ok: true,
      logName: log.name,
      plankName,
      recipe,
      planksBefore: countPlanks(bot)
    }
  },

  async execute({ bot, context, precondition }) {
    await craftRecipe(bot, precondition.recipe, 1, context)
    return { requestedCrafts: 1 }
  },

  async verifyProgress({ bot, precondition }) {
    const planksAfter = countPlanks(bot)
    const ok = planksAfter > precondition.planksBefore
    return {
      ok,
      reason: ok ? null : 'Craft resolved without increasing plank inventory',
      evidence: {
        plankName: precondition.plankName,
        planksBefore: precondition.planksBefore,
        planksAfter
      }
    }
  }
}
