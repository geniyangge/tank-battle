// Team identifier for friendly-fire prevention
export type Team = 'player' | 'enemy'

// Game state enum
export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'WAVE_TRANSITION' | 'GAME_OVER'

// 2D grid position (for A* pathfinding)
export interface GridPosition {
  row: number
  col: number
}

// 3D vector interface (to avoid coupling to THREE.Vector3 in type defs)
export interface Vec3 {
  x: number
  y: number
  z: number
}

// Tank configuration
export interface TankConfig {
  speed: number          // movement speed units/sec
  rotationSpeed: number  // chassis rotation rad/sec
  turretRotationSpeed: number // turret rotation rad/sec
  health: number
  team: Team
}

// Bullet configuration
export interface BulletConfig {
  speed: number      // 30 units/sec
  maxDistance: number // 50 units
  cooldown: number   // seconds between shots
  damage: number
}

// Collision result
export interface CollisionResult {
  hit: boolean
  normal?: Vec3
  overlap?: number
}

// Wall hit info
export interface WallHit {
  wallIndex: number
  normal: Vec3
  overlap: number
}

// Input state snapshot (per frame)
export interface InputSnapshot {
  keys: Set<string>
  mouseDelta: { x: number; y: number }
  mouseButtons: Set<number>
}
