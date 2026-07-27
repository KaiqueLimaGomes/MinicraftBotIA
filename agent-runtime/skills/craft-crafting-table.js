import { countByName, countPlanks } from '../primitives/inventory.js'
import { craftRecipe } from '../primitives/crafting.js'

export const craftCraftingTableSkill = {
  action: 'craft_crafting_table',

  async canExecute({ bot }) {
    const planksBefore = countPlanks(bot)
    if (planksBefore < 4) {
      return {
        ok: false,
        reason: 'At least four existing planks are required; logs are not converted implicitly'
      }
    }

    const table = bot.registry?.itemsByName?.crafting_table
    const recipe = table
      ? bot.recipesFor?.(table.id, null, 1, null)?.[0]
      : null
    if (!recipe) {
      return { ok: false, reason: 'No inventory recipe for crafting_table' }
    }

    return {
      ok: true,
      recipe,
      planksBefore,
      tablesBefore: countByName(bot, 'crafting_table')
    }
  },

  async execute({ bot, context, precondition }) {
    await craftRecipe(bot, precondition.recipe, 1, context)
    return { requestedCrafts: 1 }
  },

  async verifyProgress({ bot, precondition }) {
    const tablesAfter = countByName(bot, 'crafting_table')
    const planksAfter = countPlanks(bot)
    const tableCreated = tablesAfter > precondition.tablesBefore
    const didNotCreatePlanks = planksAfter <= precondition.planksBefore
    const ok = tableCreated && didNotCreatePlanks

    return {
      ok,
      reason: ok
        ? null
        : 'Craft did not create a table from the existing plank inventory',
      evidence: {
        tablesBefore: precondition.tablesBefore,
        tablesAfter,
        planksBefore: precondition.planksBefore,
        planksAfter
      }
    }
  }
}
