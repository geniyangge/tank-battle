import * as THREE from 'three'
import { PlayerTank } from '../entities/PlayerTank'

/**
 * First-person camera — positioned inside the tank cockpit,
 * facing the turret barrel direction.
 *
 * Mouse → turret rotation handled by PlayerTank.update(),
 * CameraController just syncs to the tank's turret.
 *
 * Also manages a 3D cockpit interior (viewport frame, walls, gun breach)
 * parented to the camera for a seated-in-turret feel.
 */
export class CameraController {
  private readonly camera: THREE.PerspectiveCamera
  private readonly tank: PlayerTank
  private readonly cockpitGroup: THREE.Group

  // Pre-allocated vectors (no GC in hot loop)
  private readonly eyePos = new THREE.Vector3()
  private readonly lookTarget = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera, tank: PlayerTank) {
    this.camera = camera
    this.tank = tank

    // Set FOV for cockpit feel
    this.camera.fov = 70
    this.camera.updateProjectionMatrix()

    // Build 3D cockpit interior parented to camera
    this.cockpitGroup = this.buildCockpit()
    this.cockpitGroup.visible = false
    this.camera.add(this.cockpitGroup)
  }

  // ──────────────────────────────────────────────
  //  Cockpit geometry  (viewport frame, walls, gun breach)
  // ──────────────────────────────────────────────

  private buildCockpit(): THREE.Group {
    const group = new THREE.Group()

    // Factory: create MeshBasicMaterial and track for later disposal
    const makeMat = (color: number): THREE.MeshBasicMaterial => {
      return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    }

    const darkMat = makeMat(0x0a0a0a)
    const depthMat = makeMat(0x080808)
    const breachMat = makeMat(0x1a1a1a)

    // ── Viewport frame (four panels forming a rectangular opening) ──

    // Top panel (roof) — spans full width, sits above viewport
    const topPanel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 0.5), darkMat)
    topPanel.position.set(0, 0.6, -0.4)
    group.add(topPanel)

    // Bottom panel (dashboard) — below viewport
    const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.5), darkMat)
    bottomPanel.position.set(0, -0.4, -0.4)
    group.add(bottomPanel)

    // Left panel
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.5), darkMat)
    leftPanel.position.set(-0.9, 0.1, -0.4)
    group.add(leftPanel)

    // Right panel
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.5), darkMat)
    rightPanel.position.set(0.9, 0.1, -0.4)
    group.add(rightPanel)

    // ── Interior depth (side walls extending backward for depth feel) ──

    // Left interior wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.6), depthMat)
    leftWall.position.set(-0.7, 0.1, -0.8)
    group.add(leftWall)

    // Right interior wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.6), depthMat)
    rightWall.position.set(0.7, 0.1, -0.8)
    group.add(rightWall)

    // ── Gun breach (visible at bottom-center, hints at the cannon mechanism) ──

    // Main breach block
    const breach = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.4), breachMat)
    breach.position.set(0, -0.25, -0.55)
    group.add(breach)

    // Wider breech block behind it
    const breachBlock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.3), breachMat)
    breachBlock.position.set(0, -0.2, -0.35)
    group.add(breachBlock)

    return group
  }

  // ──────────────────────────────────────────────
  //  Visibility  controls
  // ──────────────────────────────────────────────

  /** Show the cockpit interior (call when game starts / pointer is locked). */
  show(): void {
    this.cockpitGroup.visible = true
  }

  /** Hide the cockpit interior. */
  hide(): void {
    this.cockpitGroup.visible = false
  }

  /**
   * Release GPU resources.
   * Call when the game / component is torn down.
   */
  dispose(): void {
    this.camera.remove(this.cockpitGroup)

    const disposedMats = new Set<THREE.Material>()
    this.cockpitGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material && !disposedMats.has(child.material)) {
          disposedMats.add(child.material)
          child.material.dispose()
        }
      }
    })
  }

  // ──────────────────────────────────────────────
  //  Per-frame  update
  // ──────────────────────────────────────────────

  /** Sync camera to tank every frame */
  update(_delta: number): void {
    // Eye position: top of chassis = tank.position + y=0.5
    this.eyePos.copy(this.tank.position)
    this.eyePos.y += 0.5
    this.camera.position.copy(this.eyePos)

    // Face turret direction
    const dir = this.tank.getTurretForward()
    this.lookTarget.copy(this.eyePos).add(dir)
    this.camera.lookAt(this.lookTarget)
  }

  /** No-op for backward compatibility */
  setTarget(_pos: THREE.Vector3): void {}
  setMouseDelta(_dx: number, _dy: number): void {}
  setScrollDelta(_delta: number): void {}
  reset(): void {}
}
