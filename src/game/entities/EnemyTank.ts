import * as THREE from 'three'
import { Tank } from './Tank'
import type { TankConfig } from '../types'
import { findPath } from '../systems/Pathfinding'
import { MAZE_DATA, MAP_ROWS, MAP_COLS } from '../constants'
import type { Bullet } from './Bullet'
import { getInactiveBullet } from './Bullet'

// ── FSM states ──

export const AIState = {
  Patrol: 'Patrol',
  Chase: 'Chase',
  Attack: 'Attack',
  Evade: 'Evade',
} as const

export type AIState = (typeof AIState)[keyof typeof AIState]

// ── Game balance constants ──

const ENEMY_CONFIG: TankConfig = {
  speed: 3.5,
  rotationSpeed: 1.5,
  turretRotationSpeed: 2,
  health: 2,
  team: 'enemy',
}

const CHASE_RANGE = 10       // world units — start chasing
const ATTACK_RANGE = 4       // world units — start shooting
const EVADE_HEALTH_RATIO = 0.3  // health fraction — start evading
const PATROL_TARGET_UPDATE = 3   // seconds between picking new patrol target
const PATH_REFRESH = 1.0     // seconds between A* recalculations
const SHOOT_INTERVAL = 1.5   // seconds between shots
const MOVE_SPEED = 3.5       // units/sec
const ROTATION_SPEED = 1.5   // rad/sec

/**
 * Enemy tank with finite state machine (Patrol / Chase / Attack / Evade)
 * and A* pathfinding integration.
 *
 * Uses the shared bullet pool — set `bullet.team = 'enemy'` before firing.
 */
export class EnemyTank extends Tank {
  state: AIState = AIState.Patrol

  private playerRef: Tank | null = null
  private path: { x: number; z: number }[] = []
  private pathIndex = 0
  private patrolTarget: { x: number; z: number } | null = null
  private patrolTimer = 0
  private pathTimer = 0
  private shootCooldown = 0
  private readonly bulletPool: Bullet[]
  private readonly scene: THREE.Scene

  constructor(scene: THREE.Scene, position: THREE.Vector3, bulletPool: Bullet[]) {
    super(ENEMY_CONFIG, position)
    this.scene = scene
    this.bulletPool = bulletPool

    // Enemy colour scheme (dark red)
    ;(this.chassis.material as THREE.MeshStandardMaterial).color.setHex(0xcc3333)
    ;(this.turret.material as THREE.MeshStandardMaterial).color.setHex(0x992222)
    ;(this.barrel.material as THREE.MeshStandardMaterial).color.setHex(0x444444)
  }

  /** Register the player tank so the AI can track / target it. */
  setPlayerRef(player: Tank): void {
    this.playerRef = player
  }

  // ──────────────────────────────────────────────
  //  Per-frame update
  // ──────────────────────────────────────────────

  update(delta: number): void {
    if (!this.playerRef || this.isDead) return

    // 1. State transition
    this.updateState()

    // 2. Update turret logical angle toward player
    this.aimAtPlayer()

    // 3. Execute state behaviour
    switch (this.state) {
      case AIState.Patrol:
        this.handlePatrol(delta)
        break
      case AIState.Chase:
        this.handleChase(delta)
        break
      case AIState.Attack:
        this.handleAttack(delta)
        break
      case AIState.Evade:
        this.handleEvade(delta)
        break
    }

    // 4. Reduce shoot cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= delta
    }

    // 5. Push logical state to Three.js transforms
    this.updateTransforms()
  }

  // ──────────────────────────────────────────────
  //  FSM — state transition
  // ──────────────────────────────────────────────

  private updateState(): void {
    const player = this.playerRef!
    const dx = player.position.x - this.position.x
    const dz = player.position.z - this.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const healthFrac = this.health / this.config.health

    if (healthFrac < EVADE_HEALTH_RATIO && dist < ATTACK_RANGE * 2) {
      this.state = AIState.Evade
    } else if (dist < ATTACK_RANGE) {
      this.state = AIState.Attack
    } else if (dist < CHASE_RANGE) {
      this.state = AIState.Chase
    } else {
      this.state = AIState.Patrol
    }
  }

  // ──────────────────────────────────────────────
  //  FSM — state handlers
  // ──────────────────────────────────────────────

  /** Wander around the maze by picking random open cells. */
  private handlePatrol(delta: number): void {
    this.patrolTimer += delta

    // Refresh patrol target when timer expires or we have no target
    if (this.patrolTarget === null || this.patrolTimer >= PATROL_TARGET_UPDATE) {
      this.patrolTimer = 0
      this.pickPatrolTarget()
    }

    // Recalculate A* when path exhausted
    if (this.path.length === 0 || this.pathIndex >= this.path.length) {
      if (this.patrolTarget) {
        const { col, row } = this.worldToGrid()
        this.path = findPath(col, row, this.patrolTarget.x, this.patrolTarget.z, MAZE_DATA)
        this.pathIndex = 0
      }
    }

    this.followPath(delta, MOVE_SPEED * 0.7)
  }

  /** Move toward the player using A* path. */
  private handleChase(delta: number): void {
    this.pathTimer += delta

    // Periodically recalculate path to player position
    if (this.pathTimer >= PATH_REFRESH || this.path.length === 0 || this.pathIndex >= this.path.length) {
      this.pathTimer = 0
      this.repathToPlayer()
    }

    this.followPath(delta, MOVE_SPEED)
  }

  /** Stop and fire at the player. */
  private handleAttack(_delta: number): void {
    // Turret already aimed at player via aimAtPlayer()
    this.tryShoot()
  }

  /** Move perpendicular to the player while shooting. */
  private handleEvade(delta: number): void {
    const player = this.playerRef!
    const dx = this.position.x - player.position.x
    const dz = this.position.z - player.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist > 0.1) {
      // Perpendicular direction (rotate 90°): (-dz, dx) is a generic perpendicular
      const len = Math.sqrt(dx * dx + dz * dz)
      const perpX = -dz / len
      const perpZ = dx / len

      // Pick a target 5 units away in the perpendicular direction
      const targetX = this.position.x + perpX * 5
      const targetZ = this.position.z + perpZ * 5

      this.moveToward(targetX, targetZ, MOVE_SPEED * 1.2, delta)
    }

    this.tryShoot()
  }

  // ──────────────────────────────────────────────
  //  Movement helpers
  // ──────────────────────────────────────────────

  /**
   * Move the tank toward a world-space position.
   * Rotates the chassis to face the movement direction.
   */
  private moveToward(targetWorldX: number, targetWorldZ: number, speed: number, delta: number): void {
    const dx = targetWorldX - this.position.x
    const dz = targetWorldZ - this.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 0.1) return

    const dirX = dx / dist
    const dirZ = dz / dist

    // Rotate chassis toward movement direction
    const targetAngle = Math.atan2(dirX, dirZ)
    let diff = targetAngle - this._rotation
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this._rotation += Math.sign(diff) * Math.min(Math.abs(diff), ROTATION_SPEED * delta)

    // Move forward
    this._position.x += dirX * speed * delta
    this._position.z += dirZ * speed * delta
  }

  /** Follow the current A* path, advancing waypoints on arrival. */
  private followPath(delta: number, speed: number): void {
    if (this.path.length === 0) return

    while (this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex]
      const worldPos = this.gridToWorld(target.x, target.z)

      const dx = worldPos.x - this.position.x
      const dz = worldPos.z - this.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < 0.2) {
        // Reached this waypoint — advance to next
        this.pathIndex++
        continue
      }

      // Move toward current waypoint
      this.moveToward(worldPos.x, worldPos.z, speed, delta)
      return
    }

    // Path complete
    this.path = []
    this.pathIndex = 0
  }

  // ──────────────────────────────────────────────
  //  Combat helpers
  // ──────────────────────────────────────────────

  /** Point the turret toward the player (sets _turretRotation logical state). */
  private aimAtPlayer(): void {
    if (!this.playerRef) return
    const dx = this.playerRef.position.x - this.position.x
    const dz = this.playerRef.position.z - this.position.z
    const targetAngle = Math.atan2(dx, dz)
    this.setTurretRotation(targetAngle - this._rotation)
  }

  /** Fire a bullet if cooldown allows. */
  private tryShoot(): void {
    if (this.shootCooldown > 0) return
    this.shootCooldown = SHOOT_INTERVAL

    const bullet = getInactiveBullet(this.bulletPool)
    if (!bullet) return

    // Mark as enemy projectile for collision filtering
    bullet.team = 'enemy'
    bullet.fire(this.getBarrelTip(), this.getTurretForward())
    this.scene.add(bullet.mesh)
  }

  // ──────────────────────────────────────────────
  //  Patrol helpers
  // ──────────────────────────────────────────────

  /** Pick a random open cell and pathfind to it. */
  private pickPatrolTarget(): void {
    const cell = this.findRandomOpenCell()
    if (cell) {
      this.patrolTarget = { x: cell.col, z: cell.row }

      const { col, row } = this.worldToGrid()
      this.path = findPath(col, row, cell.col, cell.row, MAZE_DATA)
      this.pathIndex = 0
    }
  }

  /** Return a random open grid cell, or null after 50 failed attempts. */
  private findRandomOpenCell(): { col: number; row: number } | null {
    for (let attempt = 0; attempt < 50; attempt++) {
      const col = Math.floor(Math.random() * MAP_COLS)
      const row = Math.floor(Math.random() * MAP_ROWS)
      if (MAZE_DATA[row][col] === 0) {
        return { col, row }
      }
    }
    return null
  }

  // ──────────────────────────────────────────────
  //  Chase helpers
  // ──────────────────────────────────────────────

  /** Recalculate A* path to the player's current grid cell. */
  private repathToPlayer(): void {
    if (!this.playerRef) return
    const { col: myCol, row: myRow } = this.worldToGrid()
    const playerCol = Math.round(this.playerRef.position.x + 9.5)
    const playerRow = Math.round(this.playerRef.position.z + 9.5)
    this.path = findPath(myCol, myRow, playerCol, playerRow, MAZE_DATA)
    this.pathIndex = 0
  }

  // ──────────────────────────────────────────────
  //  Coordinate conversion
  // ──────────────────────────────────────────────

  /** Convert grid (col, row) to world (x, z). */
  private gridToWorld(col: number, row: number): { x: number; z: number } {
    return { x: col - 9.5, z: row - 9.5 }
  }

  /** Convert current position to grid (col, row). */
  private worldToGrid(): { col: number; row: number } {
    return {
      col: Math.round(this.position.x + 9.5),
      row: Math.round(this.position.z + 9.5),
    }
  }
}
