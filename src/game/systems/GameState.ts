/**
 * Game state machine and wave management.
 *
 * States:
 *   PLAYING    — full game logic runs
 *   PAUSING    — brief transition (300 ms) before PAUSED
 *   PAUSED     — game logic frozen
 *   WAVE_CLEAR — brief pause (2 s) showing wave-complete, then auto-advance
 *   GAME_OVER  — player destroyed
 */
export const GameState = {
  PLAYING: 'PLAYING',
  PAUSING: 'PAUSING',
  PAUSED: 'PAUSED',
  WAVE_CLEAR: 'WAVE_CLEAR',
  GAME_OVER: 'GAME_OVER',
} as const

export type GameState = (typeof GameState)[keyof typeof GameState]

export interface WaveState {
  currentWave: number
  enemiesAlive: number
  enemiesSpawned: number
  enemiesTotal: number // total for this wave = wave + 2
  score: number
  kills: number
}

/** Number of enemies for a given wave: wave + 2, capped at 20. */
export function getWaveEnemyCount(wave: number): number {
  return Math.min(wave + 2, 20)
}

/** Initial wave state — wave 1, 0 enemies, score 0. */
export function createInitialWaveState(): WaveState {
  const wave = 1
  return {
    currentWave: wave,
    enemiesAlive: 0,
    enemiesSpawned: 0,
    enemiesTotal: getWaveEnemyCount(wave),
    score: 0,
    kills: 0,
  }
}
