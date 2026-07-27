export function stopNavigation(bot) {
  try {
    bot.pathfinder?.stop?.()
  } catch {
    // Best effort during timeout cleanup.
  }
  try {
    bot.clearControlStates?.()
  } catch {
    // Best effort during timeout cleanup.
  }
}

export async function gotoCancelable(bot, goal, context) {
  context.assertActive()
  if (!bot.pathfinder?.goto) {
    throw new Error('Mineflayer pathfinder is not loaded')
  }

  const onAbort = () => stopNavigation(bot)
  context.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await bot.pathfinder.goto(goal)
    context.assertActive()
  } finally {
    context.signal.removeEventListener('abort', onAbort)
  }
}
