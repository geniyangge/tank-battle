import * as THREE from 'three'
import type { Team } from '../types'

export class Bullet {
  readonly mesh: THREE.Mesh
  team: Team
  readonly speed: number
  readonly maxDistance: number
  readonly damage: number

  // Movement state
  private direction = new THREE.Vector3()
  private distanceTraveled = 0
  active = false

  constructor(team: Team, speed: number, maxDistance: number, damage: number) {
    this.team = team
    this.speed = speed
    this.maxDistance = maxDistance
    this.damage = damage

    const geometry = new THREE.SphereGeometry(0.1, 8, 8)
    const material = new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      emissive: 0xffa000,
      emissiveIntensity: 0.3,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.visible = false
  }

  /** Fire the bullet from a position in a direction */
  fire(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.mesh.position.copy(position)
    this.direction.copy(direction).normalize()
    this.distanceTraveled = 0
    this.active = true
    this.mesh.visible = true
  }

  /** Per-frame update. Returns true while active, false when deactivated. */
  update(delta: number): boolean {
    if (!this.active) return false

    // Move forward
    const step = this.speed * delta
    this.mesh.position.x += this.direction.x * step
    this.mesh.position.y += this.direction.y * step
    this.mesh.position.z += this.direction.z * step
    this.distanceTraveled += step

    // Self-destruct at max distance
    if (this.distanceTraveled >= this.maxDistance) {
      this.deactivate()
      return false
    }

    return true
  }

  /** Deactivate and hide */
  deactivate(): void {
    this.active = false
    this.mesh.visible = false
  }

  /** Dispose Three.js resources */
  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}

/** Create a pool of Bullet objects (pre-allocated, reused) */
export function createBulletPool(
  team: Team,
  count: number,
  speed: number,
  maxDistance: number,
  damage: number,
): Bullet[] {
  const pool: Bullet[] = []
  for (let i = 0; i < count; i++) {
    pool.push(new Bullet(team, speed, maxDistance, damage))
  }
  return pool
}

/** Find the first inactive bullet in the pool */
export function getInactiveBullet(pool: Bullet[]): Bullet | null {
  for (const b of pool) {
    if (!b.active) return b
  }
  return null
}
