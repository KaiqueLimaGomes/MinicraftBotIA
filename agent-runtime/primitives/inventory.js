export function inventoryItems(bot) {
  return bot.inventory?.items?.() ?? []
}

export function countInventory(bot, predicate) {
  return inventoryItems(bot)
    .filter(predicate)
    .reduce((total, item) => total + item.count, 0)
}

export function countByName(bot, name) {
  return countInventory(bot, (item) => item.name === name)
}

export function countPlanks(bot) {
  return countInventory(bot, (item) => item.name.endsWith('_planks'))
}

export function findCraftableLog(bot) {
  return inventoryItems(bot).find((item) =>
    item.name.endsWith('_log') || item.name.endsWith('_stem'))
}
