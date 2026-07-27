import { craftPlanksSkill } from '../skills/craft-planks.js'
import { craftCraftingTableSkill } from '../skills/craft-crafting-table.js'
import { collectWoodSkill } from '../skills/collect-wood.js'

export const LIMITED_ACTIONS = new Set([
  'craft_planks',
  'craft_crafting_table',
  'collect_wood'
])

export function createSkillRegistry(skills = [
  craftPlanksSkill,
  craftCraftingTableSkill,
  collectWoodSkill
]) {
  const registry = new Map()

  for (const skill of skills) {
    if (!skill?.action || typeof skill.canExecute !== 'function' ||
        typeof skill.execute !== 'function' ||
        typeof skill.verifyProgress !== 'function') {
      throw new TypeError('Every skill must define action, canExecute, execute and verifyProgress')
    }
    if (registry.has(skill.action)) {
      throw new Error(`Duplicate skill: ${skill.action}`)
    }
    registry.set(skill.action, skill)
  }

  return registry
}
