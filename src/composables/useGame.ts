import { ref } from 'vue'
import * as THREE from 'three'
import { InputManager } from '../game/systems/InputManager'
import { PlayerTank } from '../game/entities/PlayerTank'
import { CollisionSystem } from '../game/systems/CollisionSystem'
import { CameraController } from '../game/systems/CameraController'
import { MAZE_DATA, MAP_ROWS, MAP_COLS } from '../game/constants'
import { EnemyTank } from '../game/entities/EnemyTank'
import { createBulletPool, getInactiveBullet, type Bullet } from '../game/entities/Bullet'
import { createExplosionPool, spawnExplosion, updateExplosions, disposeExplosions } from '../game/systems/ExplosionEffect'
import { GameState, createInitialWaveState, getWaveEnemyCount } from '../game/systems/GameState'
import type { WaveState } from '../game/systems/GameState'
import { getAudioManager } from '../game/systems/AudioManager'

export function useGame(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  _wallMeshes: THREE.Object3D[],
  canvasElement: HTMLElement,
) {
  const inputManager = InputManager.getInstance()
  const audio = getAudioManager()
  let playerTank: PlayerTank | undefined
  let cameraController: CameraController | undefined
  const collisionSystem = new CollisionSystem()

  // Bullet pool (player bullets only for now)
  const PLAYER_BULLET_SPEED = 30
  const PLAYER_BULLET_MAX_DIST = 50
  const PLAYER_BULLET_DAMAGE = 1
  const PLAYER_BULLET_POOL_SIZE = 20

  const bulletPool: Bullet[] = createBulletPool(
    'player',
    PLAYER_BULLET_POOL_SIZE,
    PLAYER_BULLET_SPEED,
    PLAYER_BULLET_MAX_DIST,
    PLAYER_BULLET_DAMAGE,
  )

  // Enemy tanks
  const enemyTanks: EnemyTank[] = []
  const MAX_ENEMIES = 8

  // Explosion effect pool (reusable, pre-allocated)
  const EXPLOSION_POOL_SIZE = 10
  const explosionPool = createExplosionPool(scene, EXPLOSION_POOL_SIZE)

  let lastTime = performance.now()
  let animFrameId = 0
  const isRunning = ref(false)

  const playerPos = ref({ x: 0, y: 0, z: 0 })
  const playerRotation = ref(0)
  const playerTurretRotation = ref(0)
  const playerHealth = ref(3)
  const playerMaxHealth = ref(3)

  // ---- Wave 6: Game state machine + wave management ----
  const gameState = ref<GameState>(GameState.PLAYING)
  const waveState = ref<WaveState>(createInitialWaveState())
  let waveClearTimer = 0

  /**
   * Find the first empty tile searching outward from the maze center.
   * World-space mapping:  x = col - 9.5,  z = row - 9.5
   */
  function findSpawnPosition(): THREE.Vector3 {
    for (let dist = 0; dist < 10; dist++) {
      for (let row = 10 - dist; row <= 10 + dist; row++) {
        for (let col = 10 - dist; col <= 10 + dist; col++) {
          if (
            row >= 0 &&
            row < MAP_ROWS &&
            col >= 0 &&
            col < MAP_COLS &&
            MAZE_DATA[row][col] === 0
          ) {
            return new THREE.Vector3(col - 9.5, 0, row - 9.5)
          }
        }
      }
    }
    return new THREE.Vector3(-0.5, 0, -0.5)
  }

  /**
   * Spawn an enemy tank at a random open cell at least 5 cells away from the player.
   * Returns the enemy or null if no suitable cell was found.
   */
  function spawnEnemyTank(): EnemyTank | null {
    if (!playerTank) return null
    const playerCol = Math.round(playerTank.position.x + 9.5)
    const playerRow = Math.round(playerTank.position.z + 9.5)

    for (let attempt = 0; attempt < 100; attempt++) {
      const col = Math.floor(Math.random() * MAP_COLS)
      const row = Math.floor(Math.random() * MAP_ROWS)
      if (MAZE_DATA[row][col] !== 0) continue

      const dist = Math.abs(col - playerCol) + Math.abs(row - playerRow)
      if (dist < 5) continue

      const wx = col - 9.5
      const wz = row - 9.5
      const enemy = new EnemyTank(scene, new THREE.Vector3(wx, 0, wz), bulletPool)
      enemy.setPlayerRef(playerTank)
      scene.add(enemy.group)
      collisionSystem.registerTank(enemy)
      enemyTanks.push(enemy)
      return enemy
    }
    return null
  }

  function start(): void {
    const spawnPos = findSpawnPosition()
    playerTank = new PlayerTank(spawnPos)
    scene.add(playerTank.group)
    collisionSystem.registerTank(playerTank)
    cameraController = new CameraController(camera, playerTank)
    cameraController.setTarget(spawnPos)
    cameraController.show()

    // Reset game state for fresh game
    gameState.value = GameState.PLAYING
    waveState.value = createInitialWaveState()
    waveClearTimer = 0

    isRunning.value = true
    lastTime = performance.now()
    loop(lastTime)
  }

  function loop(now: number): void {
    if (!isRunning.value || !playerTank) return
    animFrameId = requestAnimationFrame(loop)

    const delta = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now

    // ---- State-specific logic ----
    switch (gameState.value) {
      case GameState.PLAYING:
        updatePlaying(delta)
        break
      case GameState.WAVE_CLEAR:
        updateWaveClear(delta)
        break
      case GameState.GAME_OVER:
        // No game logic — just camera update below
        break
    }

    // Always update camera + input
    cameraController?.update(delta)
    inputManager.update()
  }

  // ── State handlers ──────────────────────────────────────────

  function updatePlaying(delta: number): void {
    if (!playerTank) return

    // 1. Player movement
    playerTank.update(delta)
    collisionSystem.checkWallCollision(playerTank)
    playerTank.group.position.copy(playerTank.position)

    // 2. Enemy AI update
    for (const enemy of enemyTanks) {
      if (enemy.isDead) continue
      enemy.update(delta)
      enemy.group.position.copy(enemy.position)
    }

    // 3. Tank ↔ Tank collisions
    collisionSystem.checkTankCollisions()

    // 4. Expose player transform + health for minimap / HUD
    const pos = playerTank.position
    playerPos.value = { x: pos.x, y: pos.y, z: pos.z }
    playerRotation.value = playerTank.rotation
    playerTurretRotation.value = playerTank.turretRotation
    playerHealth.value = playerTank.health
    playerMaxHealth.value = playerTank.config.health

    // 5. Player bullet firing
    const shot = playerTank.shouldShoot()
    if (shot) {
      const bullet = getInactiveBullet(bulletPool)
      if (bullet) {
        bullet.team = 'player'
        bullet.fire(shot.position, shot.direction)
        scene.add(bullet.mesh)
        playerTank.resetShotCooldown()
        audio.playShoot()
      }
    }

    // 6. Bullet updates + collisions
    for (const bullet of bulletPool) {
      if (!bullet.active) continue

      bullet.update(delta)

      const hit = collisionSystem.checkBulletCollision(bullet)
      if (hit.hitWall) {
        spawnExplosion(explosionPool, bullet.mesh.position)
        bullet.deactivate()
        scene.remove(bullet.mesh)
        audio.playExplosion()
      }
      if (hit.hitTank) {
        spawnExplosion(explosionPool, bullet.mesh.position)
        bullet.deactivate()
        scene.remove(bullet.mesh)
        audio.playExplosion()

        const destroyed = hit.hitTank.takeDamage(bullet.damage)
        audio.playHit()

        // Enemy destroyed → score +10, update wave state
        if (destroyed && hit.hitTank !== playerTank) {
          const enemy = hit.hitTank as EnemyTank
          scene.remove(enemy.group)
          collisionSystem.unregisterTank(enemy)
          const idx = enemyTanks.indexOf(enemy)
          if (idx !== -1) enemyTanks.splice(idx, 1)

          const ws = waveState.value
          waveState.value = {
            ...ws,
            score: ws.score + 10,
            kills: ws.kills + 1,
            enemiesAlive: Math.max(0, ws.enemiesAlive - 1),
          }
        } else if (destroyed) {
          // Player destroyed → game over
          gameState.value = GameState.GAME_OVER
          audio.playGameOver()
        }
      }
    }

    // 7. Wave spawning (gradual — cap at MAX_ENEMIES on screen)
    updateWaveSpawning()

    // 8. Check wave clear condition
    const ws = waveState.value
    if (
      ws.enemiesAlive === 0 &&
      ws.enemiesSpawned >= ws.enemiesTotal &&
      ws.enemiesSpawned > 0
    ) {
      gameState.value = GameState.WAVE_CLEAR
      waveClearTimer = 0
      audio.playWaveClear()
    }

    // 9. Explosion animations
    updateExplosions(explosionPool, delta)
  }

  function updateWaveClear(delta: number): void {
    waveClearTimer += delta
    if (waveClearTimer >= 2.0) {
      waveClearTimer = 0
      const nextWave = waveState.value.currentWave + 1
      const ws = waveState.value
      waveState.value = {
        ...ws,
        currentWave: nextWave,
        enemiesSpawned: 0,
        enemiesTotal: getWaveEnemyCount(nextWave),
      }
      gameState.value = GameState.PLAYING
    }
  }

  function updateWaveSpawning(): void {
    const ws = waveState.value
    while (
      ws.enemiesSpawned < ws.enemiesTotal &&
      enemyTanks.length < MAX_ENEMIES
    ) {
      if (spawnEnemyTank()) {
        ws.enemiesSpawned++
        ws.enemiesAlive++
        waveState.value = { ...ws }
      } else {
        break
      }
    }
  }

  function togglePause(): void {
    if (gameState.value === GameState.PLAYING) {
      gameState.value = GameState.PAUSING
      setTimeout(() => { gameState.value = GameState.PAUSED }, 300)
    } else if (gameState.value === GameState.PAUSED) {
      gameState.value = GameState.PLAYING
    }
  }

  function restart(): void {
    // Clean up existing player
    if (playerTank) {
      collisionSystem.unregisterTank(playerTank)
      scene.remove(playerTank.group)
      playerTank.dispose()
    }

    // Clean up enemy tanks
    for (const enemy of enemyTanks) {
      collisionSystem.unregisterTank(enemy)
      scene.remove(enemy.group)
      enemy.dispose()
    }
    enemyTanks.length = 0

    // Reset bullet pool
    for (const b of bulletPool) {
      if (b.mesh.parent) scene.remove(b.mesh)
      b.deactivate()
    }

    // Camera cleanup
    cameraController?.hide()
    cameraController?.dispose()
    cameraController = undefined

    // Start a fresh game
    start()
  }

  function stop(): void {
    isRunning.value = false
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = 0
    }
  }

  function dispose(): void {
    stop()

    // Remove enemy tanks
    for (const enemy of enemyTanks) {
      collisionSystem.unregisterTank(enemy)
      if (enemy.group.parent) {
        scene.remove(enemy.group)
      }
      enemy.dispose()
    }
    enemyTanks.length = 0

    // Remove player tank
    if (playerTank) {
      collisionSystem.unregisterTank(playerTank)
      if (playerTank.group.parent) {
        scene.remove(playerTank.group)
      }
      playerTank.dispose()
    }
    cameraController?.hide()
    cameraController?.dispose()
    for (const bullet of bulletPool) {
      if (bullet.mesh.parent) scene.remove(bullet.mesh)
      bullet.dispose()
    }
    disposeExplosions(explosionPool)
  }

  function setScrollDelta(delta: number): void {
    cameraController?.setScrollDelta(delta)
  }

  function requestPointerLock(): void {
    inputManager.requestPointerLock(canvasElement)
  }

  function snapTurret(): void {
    playerTank?.snapTurretForward()
  }

  return {
    start,
    stop,
    dispose,
    isRunning,
    requestPointerLock,
    setScrollDelta,
    togglePause,
    restart,
    snapTurret,
    playerPos,
    playerRotation,
    playerTurretRotation,
    playerHealth,
    playerMaxHealth,
    gameState,
    waveState,
  }
}
