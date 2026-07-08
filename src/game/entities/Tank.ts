import * as THREE from 'three'
import type { TankConfig } from '../types'

const UP = new THREE.Vector3(0, 1, 0)

export class Tank {
  readonly team: TankConfig['team']
  readonly config: TankConfig
  health: number

  readonly group: THREE.Group
  readonly chassis: THREE.Mesh
  readonly turret: THREE.Mesh
  readonly barrel: THREE.Mesh

  protected _position: THREE.Vector3
  protected _rotation = 0
  protected _turretRotation = 0

  constructor(config: TankConfig, position?: THREE.Vector3) {
    this.config = config
    this.team = config.team
    this.health = config.health

    this._position = position?.clone() ?? new THREE.Vector3()

    // Root group
    this.group = new THREE.Group()

    // Chassis — the body box, rotates with WASD (chassis._rotation.y)
    const chassisGeo = new THREE.BoxGeometry(0.8, 0.6, 0.8)
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x808080 })
    this.chassis = new THREE.Mesh(chassisGeo, chassisMat)
    this.chassis.position.y = 0.3
    this.group.add(this.chassis)

    // Turret — cylinder on top, rotates independently on Y (turret._rotation.y)
    const turretGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3)
    const turretMat = new THREE.MeshStandardMaterial({ color: 0x606060 })
    this.turret = new THREE.Mesh(turretGeo, turretMat)
    this.turret.position.y = 0.45
    this.group.add(this.turret)

    // Barrel — child of turret, points forward (-Z) after -PI/2 X rotation
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444 })
    this.barrel = new THREE.Mesh(barrelGeo, barrelMat)
    this.barrel.position.set(0, 0.15, -0.35)
    this.barrel.rotation.x = Math.PI / 2
    this.turret.add(this.barrel)

    // Apply initial position
    if (position) {
      this.group.position.copy(position)
    }
  }

  get position(): THREE.Vector3 {
    return this._position
  }

  get rotation(): number {
    return this._rotation
  }

  get turretRotation(): number {
    return this._turretRotation
  }

  /** World-space forward direction of the chassis */
  get forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this._rotation)
  }

  /** Barrel tip position in world space (for spawning bullets) */
  getBarrelTip(): THREE.Vector3 {
    return new THREE.Vector3(0, 0.5, -0.35)
      .applyQuaternion(this.turret.quaternion)
      .add(this.group.position)
  }

  /** Apply damage. Returns true if the tank is destroyed. */
  takeDamage(amount: number): boolean {
    this.health -= amount
    return this.health <= 0
  }

  get isDead(): boolean {
    return this.health <= 0
  }

  /** Sync Three.js transforms from logical state (_position, _rotation, _turretRotation) */
  protected updateTransforms(): void {
    this.group.position.copy(this._position)
    this.chassis.rotation.y = this._rotation
    // Turret rotation is relative to chassis
    this.turret.rotation.y = this._rotation + this._turretRotation
  }

  /** Set turret Y rotation relative to chassis */
  setTurretRotation(angle: number): void {
    this._turretRotation = angle
  }

  /** World-space forward direction of the turret (where barrel points) */
  getTurretForward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.turret.quaternion)
  }

  /** Dispose Three.js geometry and materials */
  dispose(): void {
    this.barrel.geometry.dispose()
    ;(this.barrel.material as THREE.Material).dispose()
    this.turret.geometry.dispose()
    ;(this.turret.material as THREE.Material).dispose()
    this.chassis.geometry.dispose()
    ;(this.chassis.material as THREE.Material).dispose()
  }
}
