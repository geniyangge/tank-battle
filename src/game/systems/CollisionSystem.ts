import * as THREE from 'three'
import { Tank } from '../entities/Tank'
import { Bullet } from '../entities/Bullet'
import { MAZE_DATA, MAP_ROWS, MAP_COLS } from '../constants'
import type { WallHit, Vec3 } from '../types'

/** Bullet collision check result */
export interface BulletCollisionResult {
  hitWall: boolean
  hitTank: Tank | null
}

/**
 * Three-layer collision system for the tank battle game.
 *
 * Layer 1: Tank ↔ Wall — Box3 intersection + minimum-separation push
 * Layer 2: Bullet collision — (deferred to Wave 4)
 * Layer 3: Tank ↔ Tank — XZ-plane overlap + equal push apart
 *
 * Wall boxes are pre-built from MAZE_DATA at construction time.
 * Tank boxes are computed on-the-fly from chassis dimensions.
 */
export class CollisionSystem {
  /**
   * 2D grid of wall bounding boxes (null where there is no wall).
   * Pre-built once in the constructor so we never iterate MAZE_DATA
   * during the hot loop.
   */
  private wallGrid: (THREE.Box3 | null)[][] = []

  /** All tanks registered for tank ↔ tank collision. */
  private tanks: Tank[] = []

  constructor() {
    this.buildWallGrid()
  }

  // ---------------------------------------------------------------
  //  Wall grid construction
  // ---------------------------------------------------------------

  /**
   * Walk MAZE_DATA and create a THREE.Box3 for every wall tile.
   *
   * World-space mapping:
   *   x = col - 9.5     z = row - 9.5
   *
   * Wall box:  1 unit wide, 2 units tall, 1 unit deep
   *   min = (x - 0.5, 0, z - 0.5)
   *   max = (x + 0.5, 2, z + 0.5)
   */
  private buildWallGrid(): void {
    for (let row = 0; row < MAP_ROWS; row++) {
      this.wallGrid[row] = []
      for (let col = 0; col < MAP_COLS; col++) {
        if (MAZE_DATA[row][col] === 1) {
          const x = col - 9.5
          const z = row - 9.5
          this.wallGrid[row][col] = new THREE.Box3(
            new THREE.Vector3(x - 0.5, 0, z - 0.5),
            new THREE.Vector3(x + 0.5, 2, z + 0.5),
          )
        } else {
          this.wallGrid[row][col] = null
        }
      }
    }
  }

  // ---------------------------------------------------------------
  //  Tank lifecycle
  // ---------------------------------------------------------------

  /**
   * Start tracking a tank for tank ↔ tank collision.
   * Call once when the tank enters the game world.
   */
  registerTank(tank: Tank): void {
    this.tanks.push(tank)
  }

  /**
   * Stop tracking a tank (e.g. when destroyed or removed).
   * Safe to call even if the tank was never registered.
   */
  unregisterTank(tank: Tank): void {
    const index = this.tanks.indexOf(tank)
    if (index !== -1) {
      // Swap-remove for O(1) — order in the array does not matter
      this.tanks[index] = this.tanks[this.tanks.length - 1]
      this.tanks.pop()
    }
  }

  // ---------------------------------------------------------------
  //  Per-frame update
  // ---------------------------------------------------------------

  /**
   * Prepare internal state for the current frame.
   * Call once per tick before checkWallCollision / checkTankCollisions.
   *
   * Currently a no-op because tank boxes are computed on-the-fly.
   * Reserved for future optimisation (e.g. cached AABB recompute).
   */
  update(): void {
    // no-op
  }

  // ---------------------------------------------------------------
  //  Layer 1 — Tank ↔ Wall
  // ---------------------------------------------------------------

  /**
   * Check a single tank against all nearby walls, correct its position
   * by pushing it out of each penetrated wall, and return a descriptor
   * for every collision that occurred.
   *
   * Optimisation: only walls within a 3×3 cell neighbourhood around
   * the tank's current grid position are tested.  The grid position
   * is derived from the world position:
   *   col = Math.round(x + 9.5)
   *   row = Math.round(z + 9.5)
   *
   * Separation axis selection (minimum overlap):
   *   When two AABBs intersect, the axis with the smallest penetration
   *   depth is the axis of minimum separation.  Pushing along that axis
   *   requires the least displacement to resolve the intersection.
   *
   * @param tank  The tank to test (position is corrected in-place).
   * @returns An array of WallHit, one per colliding wall.
   */
  checkWallCollision(tank: Tank): WallHit[] {
    const hits: WallHit[] = []

    // Grid position of the tank's centre
    const col = Math.max(0, Math.min(MAP_COLS - 1, Math.round(tank.position.x + 9.5)))
    const row = Math.max(0, Math.min(MAP_ROWS - 1, Math.round(tank.position.z + 9.5)))

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr
        const c = col + dc
        if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) continue

        const wallBox = this.wallGrid[r][c]
        if (wallBox === null) continue

        // Compute fresh tank box every iteration so earlier position
        // corrections are reflected in subsequent checks.
        const tankBox = this.computeTankWorldBox(tank)

        if (!tankBox.intersectsBox(wallBox)) continue

        // ---- Separation axis selection ----
        //
        // The tank and wall overlap on both X and Z (Y-axis is ignored
        // for ground vehicles — they never leave the horizontal plane).
        //
        // overlapAxis = max(0, min(aMax, bMax) - max(aMin, bMin))
        //
        // The axis with the *smaller* positive overlap is the minimum-
        // separation axis: pushing along it resolves the collision with
        // the least displacement.

        const tankCenter = tankBox.getCenter(new THREE.Vector3())
        const wallCenter = wallBox.getCenter(new THREE.Vector3())

        const overlapX = Math.min(tankBox.max.x, wallBox.max.x) - Math.max(tankBox.min.x, wallBox.min.x)
        const overlapZ = Math.min(tankBox.max.z, wallBox.max.z) - Math.max(tankBox.min.z, wallBox.min.z)

        const useX = overlapX <= overlapZ

        const overlap = useX ? overlapX : overlapZ
        const sign = useX
          ? (tankCenter.x < wallCenter.x ? -1 : 1)
          : (tankCenter.z < wallCenter.z ? -1 : 1)

        const normal: Vec3 = useX
          ? { x: sign, y: 0, z: 0 }
          : { x: 0, y: 0, z: sign }

        // Push tank back — only X or Z, never Y
        if (useX) {
          tank.position.x += sign * overlap
        } else {
          tank.position.z += sign * overlap
        }

        hits.push({
          wallIndex: r * MAP_COLS + c,
          normal,
          overlap,
        })
      }
    }

    return hits
  }

  // ---------------------------------------------------------------
  //  Layer 3 — Tank ↔ Tank
  // ---------------------------------------------------------------

  /**
   * Check every pair of registered tanks for XZ-plane overlap and
   * push them apart equally (half the overlap distance each).
   *
   * Only horizontal (XZ) overlap is considered — Y-axis is ignored.
   * The separation axis is the one with the smaller overlap, matching
   * the wall-collision algorithm.
   *
   * Each tank receives the same displacement magnitude so momentum
   * is shared (equal-mass approximation).
   */
  checkTankCollisions(): void {
    for (let i = 0; i < this.tanks.length; i++) {
      for (let j = i + 1; j < this.tanks.length; j++) {
        const a = this.tanks[i]
        const b = this.tanks[j]

        const boxA = this.computeTankWorldBox(a)
        const boxB = this.computeTankWorldBox(b)

        // Overlap on each horizontal axis
        const overlapX = Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x)
        const overlapZ = Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z)

        // No intersection if either axis has zero / negative overlap
        if (overlapX <= 0 || overlapZ <= 0) continue

        const centerA = boxA.getCenter(new THREE.Vector3())
        const centerB = boxB.getCenter(new THREE.Vector3())

        // Minimum-separation axis selection
        if (overlapX < overlapZ) {
          const sign = centerA.x < centerB.x ? -1 : 1
          const half = overlapX / 2
          a.position.x += sign * half
          b.position.x -= sign * half
        } else {
          const sign = centerA.z < centerB.z ? -1 : 1
          const half = overlapZ / 2
          a.position.z += sign * half
          b.position.z -= sign * half
        }
      }
    }
  }

  // ---------------------------------------------------------------
  //  Layer 2 — Bullet ↔ Walls / Tanks
  // ---------------------------------------------------------------

  /**
   * Check a bullet against walls and tanks.
   *
   * Layer 2 bullet collision: tests the bullet's bounding box against
   * the 3×3 wall neighbourhood around its grid position, then against
   * every registered tank (excluding the bullet's own team).
   *
   * Returns immediately on the first hit — a bullet can only hit one
   * object before being destroyed.
   *
   * @param bullet  The bullet to test.
   * @returns BulletCollisionResult describing what was hit (if anything).
   */
  checkBulletCollision(bullet: Bullet): BulletCollisionResult {
    const result: BulletCollisionResult = { hitWall: false, hitTank: null }

    // Skip inactive bullets
    if (!bullet.active) return result

    // Bullet bounding box (tiny sphere radius 0.1)
    const bulletBox = new THREE.Box3().setFromObject(bullet.mesh)

    // Grid position of the bullet's centre (clamped to grid bounds)
    const col = Math.max(0, Math.min(MAP_COLS - 1, Math.round(bullet.mesh.position.x + 9.5)))
    const row = Math.max(0, Math.min(MAP_ROWS - 1, Math.round(bullet.mesh.position.z + 9.5)))

    // Check 3×3 neighbourhood for wall collision
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr
        const c = col + dc
        if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) continue

        const wallBox = this.wallGrid[r][c]
        if (wallBox === null) continue

        if (bulletBox.intersectsBox(wallBox)) {
          result.hitWall = true
          return result // Bullet destroyed on first wall hit
        }
      }
    }

    // Check against all registered tanks (skip own team for friendly-fire prevention)
    for (const tank of this.tanks) {
      if (tank.team === bullet.team) continue

      const tankBox = this.computeTankWorldBox(tank)
      if (bulletBox.intersectsBox(tankBox)) {
        result.hitTank = tank
        return result // Bullet destroyed on first tank hit
      }
    }

    return result
  }

  // ---------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------

  /**
   * Build an axis-aligned world-space bounding box for a tank.
   *
   * The tank chassis is BoxGeometry(0.8, 0.6, 0.8) with its bottom
   * at y = 0.  This produces:
   *   min = (x - 0.4, 0, z - 0.4)
   *   max = (x + 0.4, 0.6, z + 0.4)
   *
   * Note: because this is an AABB and the tank can rotate, the actual
   * footprint may be slightly larger at 45° angles.  Using the chassis
   * dimensions directly is a pragmatic simplification for this stage.
   */
  private computeTankWorldBox(tank: Tank): THREE.Box3 {
    const pos = tank.position
    const half = 0.4
    return new THREE.Box3(
      new THREE.Vector3(pos.x - half, 0, pos.z - half),
      new THREE.Vector3(pos.x + half, 0.6, pos.z + half),
    )
  }
}
