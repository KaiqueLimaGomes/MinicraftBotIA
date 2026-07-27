export const LOCAL_RCON_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export function validateExperimentConfig({
  rconHost,
  password,
  repetitions,
  allowRemote = false
}) {
  if (!LOCAL_RCON_HOSTS.has(rconHost) && !allowRemote) {
    return { ok: false, reason: 'REMOTE_RCON_BLOCKED' }
  }
  if (!password) return { ok: false, reason: 'RCON_PASSWORD_REQUIRED' }
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
    return { ok: false, reason: 'INVALID_REPETITIONS' }
  }
  return { ok: true }
}
