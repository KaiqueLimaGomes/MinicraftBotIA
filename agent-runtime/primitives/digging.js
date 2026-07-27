export function stopDigging(bot) {
  try {
    bot.stopDigging?.()
  } catch {
    // Best effort during timeout cleanup.
  }
}

export async function digCancelable(bot, block, context) {
  context.assertActive()
  if (!bot.canDigBlock?.(block)) {
    throw new Error(`Block ${block?.name ?? 'unknown'} is not diggable`)
  }

  const onAbort = () => stopDigging(bot)
  context.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await bot.dig(block, true)
    context.assertActive()
  } finally {
    context.signal.removeEventListener('abort', onAbort)
  }
}
