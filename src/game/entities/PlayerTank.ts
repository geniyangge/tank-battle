import * as THREE from 'three'
import { Tank } from './Tank'
import { InputManager } from '../systems/InputManager'
import type { TankConfig } from '../types'

// ---- Game balance constants ----

const TANK_SPEED = 5
const TANK_ROTATION_SPEED = 2
const TURRET_ROTATION_SPEED = 3

/** Player tank configuration */
const PLAYER_CONFIG: TankConfig = {
  speed: TANK_SPEED,
  rotationSpeed: TANK_ROTATION_SPEED,
  turretRotationSpeed: TURRET_ROTATION_SPEED,
  health: 3,
  team: 'player',
}

/** Mouse-to-turret rotation sensitivity factor */
const MOUSE_SENSITIVITY = 0.005

/** Minimum interval between shots in milliseconds */
const SHOT_COOLDOWN_MS = 333

export class PlayerTank extends Tank {
  private readonly inputManager: InputManager
  private lastShotTime = 0

  constructor(position: THREE.Vector3) {
    super(PLAYER_CONFIG, position)

    this.inputManager = InputManager.getInstance()

    // Player colour scheme
    ;(this.chassis.material as THREE.MeshStandardMaterial).color.setHex(0x4CAF50)
    ;(this.turret.material as THREE.MeshStandardMaterial).color.setHex(0x388E3C)
    ;(this.barrel.material as THREE.MeshStandardMaterial).color.setHex(0x333333)
  }

  /** Per-frame update — call every tick with the frame delta in seconds */
  update(delta: number): void {
    const input = this.inputManager
    const forward = this.forward

    // W / S — move forward / backward along chassis facing direction
    if (input.isKeyDown('KeyW')) {
      this._position.x += forward.x * this.config.speed * delta
      this._position.z += forward.z * this.config.speed * delta
    }
    if (input.isKeyDown('KeyS')) {
      this._position.x -= forward.x * this.config.speed * delta
      this._position.z -= forward.z * this.config.speed * delta
    }

    // A / D — rotate chassis
    if (input.isKeyDown('KeyA')) {
      this._rotation += this.config.rotationSpeed * delta
    }
    if (input.isKeyDown('KeyD')) {
      this._rotation -= this.config.rotationSpeed * delta
    }

    // Mouse X delta — rotate turret independently
    const mouseDelta = input.getMouseDelta()
    this._turretRotation -= mouseDelta.x * this.config.turretRotationSpeed * MOUSE_SENSITIVITY

    // Q / E — rotate turret independently of body
    if (input.isKeyDown('KeyQ')) {
      this._turretRotation += this.config.turretRotationSpeed * delta
    }
    if (input.isKeyDown('KeyE')) {
      this._turretRotation -= this.config.turretRotationSpeed * delta
    }

    // Push logical state to Three.js objects
    this.updateTransforms()
  }

  /** Current signed chassis speed (positive = forward, for sound / HUD) */
  getCurrentSpeed(): number {
    const input = this.inputManager
    if (input.isKeyDown('KeyW')) return this.config.speed
    if (input.isKeyDown('KeyS')) return -this.config.speed
    return 0
  }

  /**
   * Returns barrel-tip position + direction when the player fires this frame.
   * Returns `null` when the fire button is not pressed or the cooldown is still active.
   */
  shouldShoot(): { position: THREE.Vector3; direction: THREE.Vector3 } | null {
    if (
      this.inputManager.isMouseButtonDown(0)
      && performance.now() - this.lastShotTime > SHOT_COOLDOWN_MS
    ) {
      return {
        position: this.getBarrelTip(),
        direction: this.getTurretForward(),
      }
    }
    return null
  }

  /** Reset shot cooldown (call after a bullet has been created). */
  resetShotCooldown(): void {
    this.lastShotTime = performance.now()
  }

  /**
   * Snap turret to align with chassis forward direction.
   * Sets _turretRotation to 0 so turret points the same way as chassis.
   */
  snapTurretForward(): void {
    this._turretRotation = 0
  }
}
