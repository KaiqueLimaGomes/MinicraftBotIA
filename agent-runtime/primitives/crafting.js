import { ExecutionAbortedError } from '../runtime/execution-errors.js'

export async function craftRecipe(bot, recipe, amount, context) {
  context.assertActive()

  const onAbort = () => {
    try {
      bot.closeWindow?.(bot.currentWindow)
    } catch {
      // Best-effort cleanup; the executionId gate still rejects late completion.
    }
  }

  context.signal.addEventListener('abort', onAbort, { once: true })
  try {
    await bot.craft(recipe, amount, null)
    if (context.signal.aborted || !context.isCurrent()) {
      throw new ExecutionAbortedError('Craft completed after execution ended')
    }
  } finally {
    context.signal.removeEventListener('abort', onAbort)
  }
}
