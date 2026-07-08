import * as THREE from 'three'

export interface Explosion {
  mesh: THREE.Mesh
  active: boolean
  timer: number
  duration: number
  startScale: number
}

export function createExplosionPool(scene: THREE.Scene, count: number): Explosion[] {
  const pool: Explosion[] = []
  const geometry = new THREE.SphereGeometry(0.3, 8, 8)

  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 1,
    })
    const mesh = new THREE.Mesh(geometry.clone(), material)
    mesh.visible = false
    scene.add(mesh)

    pool.push({
      mesh,
      active: false,
      timer: 0,
      duration: 0.3,
      startScale: 0.2,
    })
  }

  return pool
}

export function spawnExplosion(pool: Explosion[], position: THREE.Vector3): void {
  for (const ex of pool) {
    if (!ex.active) {
      ex.mesh.position.copy(position)
      ex.mesh.scale.set(ex.startScale, ex.startScale, ex.startScale)
      ex.mesh.visible = true
      ;(ex.mesh.material as THREE.MeshBasicMaterial).opacity = 1
      ex.active = true
      ex.timer = 0
      return
    }
  }
}

export function updateExplosions(pool: Explosion[], delta: number): void {
  for (const ex of pool) {
    if (!ex.active) continue

    ex.timer += delta
    const progress = ex.timer / ex.duration

    if (progress >= 1) {
      ex.mesh.visible = false
      ex.active = false
      continue
    }

    // Scale up then shrink
    const scale = progress < 0.3
      ? ex.startScale + (1 - ex.startScale) * (progress / 0.3)
      : 1 - (progress - 0.3) / 0.7

    ex.mesh.scale.set(scale, scale, scale)

    // Fade out
    ;(ex.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress
  }
}

export function disposeExplosions(pool: Explosion[]): void {
  for (const ex of pool) {
    ex.mesh.geometry.dispose()
    ;(ex.mesh.material as THREE.Material).dispose()
  }
}
