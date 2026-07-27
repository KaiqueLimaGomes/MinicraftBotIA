import pathfinderPackage from 'mineflayer-pathfinder'

const { Movements } = pathfinderPackage

export function createSafeMovements(bot) {
  const movements = new Movements(bot)
  movements.canDig = false
  movements.allow1by1towers = false
  movements.allowParkour = false
  movements.scafoldingBlocks = []
  movements.maxDropDown = 1
  return movements
}
