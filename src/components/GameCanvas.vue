<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { TresCanvas } from '@tresjs/core'
import * as THREE from 'three'
import { MAZE_DATA, MAP_ROWS, MAP_COLS, TILE_SIZE, WALL_HEIGHT } from '../game/constants'
import { useGame } from '../composables/useGame'
import Minimap from './Minimap.vue'
import GameHUD from './GameHUD.vue'

const game = ref<ReturnType<typeof useGame>>()
const isPointerLocked = ref(false)

// TresCanvas v5 uses its own internal camera for rendering.
// We create a dedicated camera at the top level and pass it
// via the :camera prop so CameraController's updates take effect.
const gameCamera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
)
function onResize(): void {
  gameCamera.aspect = window.innerWidth / window.innerHeight
  gameCamera.updateProjectionMatrix()
}

// Unwrap nested refs from useGame for template prop binding
const minimapPlayerPos = computed(() => game.value?.playerPos?.value ?? { x: 0, y: 0, z: 0 })
const minimapPlayerRotation = computed(() => game.value?.playerRotation?.value ?? 0)

// HUD prop wrappers
const hudGameState = computed(() => game.value?.gameState?.value ?? 'PLAYING')
const hudWaveState = computed(() => game.value?.waveState?.value ?? {
  currentWave: 1, enemiesAlive: 0, enemiesSpawned: 0, enemiesTotal: 3, score: 0, kills: 0,
})
const hudPlayerHealth = computed(() => game.value?.playerHealth?.value ?? 3)
const hudPlayerMaxHealth = computed(() => game.value?.playerMaxHealth?.value ?? 3)
const hudPlayerRotation = computed(() => game.value?.playerRotation?.value ?? 0)
const hudPlayerTurretRotation = computed(() => game.value?.playerTurretRotation?.value ?? 0)

let wallMeshes: THREE.Object3D[] = []

function onReady(context: any) {
  const scene = context.scene.value as THREE.Scene
  // Use the top-level gameCamera (passed to TresCanvas via :camera prop)
  // Must add to scene so cockpit children (cockpitGroup) get rendered
  gameCamera.position.set(0, 15, 20)
  gameCamera.lookAt(0, 0, 0)
  scene.add(gameCamera)

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 })

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (MAZE_DATA[row][col] === 1) {
        const x = col - 9.5
        const z = row - 9.5
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE),
          wallMaterial,
        )
        wall.position.set(x, WALL_HEIGHT / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        scene.add(wall)
        wallMeshes.push(wall)
      }
    }
  }

  // Get the canvas element. @ready fires after the canvas exists in DOM,
  // so a direct querySelector is reliable.
  const canvasEl = document.querySelector<HTMLCanvasElement>('canvas')
  if (!canvasEl) return

  const g = useGame(scene, gameCamera, wallMeshes, canvasEl)
  game.value = g
  g.start()
}

function onClick(): void {
  if (!game.value || isPointerLocked.value) return
  game.value.requestPointerLock()
}

function onPointerLockChange(): void {
  isPointerLocked.value = document.pointerLockElement !== null
}

function onWheel(event: WheelEvent): void {
  if (game.value) {
    game.value.setScrollDelta(event.deltaY)
  }
}

function handleRestart(): void {
  game.value?.restart()
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.code === 'KeyR' && hudGameState.value === 'GAME_OVER') {
    handleRestart()
  }
  if (e.code === 'Space' && isPointerLocked.value) {
    e.preventDefault()
    game.value?.snapTurret()
  }
}

onMounted(() => {
  document.addEventListener('pointerlockchange', onPointerLockChange)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', onResize)
  game.value?.dispose()
})
</script>

<template>
  <div
    class="game-container"
    @click="onClick"
    @wheel.prevent="onWheel"
  >
    <TresCanvas
      window-size
      clear-color="#87CEEB"
      :camera="gameCamera"
      @ready="onReady"
    >
      <TresHemisphereLight
        :args="[0x87CEEB, 0x444422, 1]"
      />
      <TresDirectionalLight
        :position="[10, 20, 10] as any"
        :intensity="1.5"
        cast-shadow
      />
      <TresGridHelper :args="[20, 20]" />
      <TresMesh
        :rotation="[-Math.PI / 2, 0, 0] as any"
        :position="[0, -0.01, 0] as any"
        receive-shadow
      >
        <TresPlaneGeometry :args="[20, 20]" />
        <TresMeshStandardMaterial color="#4CAF50" />
      </TresMesh>
    </TresCanvas>

    <!-- Click-to-play overlay -->
    <div v-if="!isPointerLocked" class="click-overlay">
      <div class="click-card">
        <div class="click-icon">
          <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
            <rect x="12" y="22" width="40" height="24" rx="4" stroke="rgba(255,255,255,0.9)" stroke-width="2" fill="rgba(76,175,80,0.15)"/>
            <circle cx="32" cy="34" r="8" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" fill="none"/>
            <line x1="32" y1="26" x2="32" y2="18" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="32" y1="18" x2="36" y2="22" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="32" y1="18" x2="28" y2="22" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="22" y="40" width="20" height="8" rx="2" stroke="rgba(255,255,255,0.4)" stroke-width="1" fill="none"/>
          </svg>
        </div>
        <p class="click-title">点击进入坦克</p>
        <p class="click-subtitle">点击屏幕以开始</p>
        <div class="click-controls">
          <span class="key-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span>
          <span class="key-hint"><kbd>鼠标</kbd> 瞄准</span>
          <span class="key-hint"><kbd>左键</kbd> 开火</span>
          <span class="key-hint"><kbd>Q</kbd><kbd>E</kbd> 炮塔旋转</span>
          <span class="key-hint"><kbd>Space</kbd> 炮塔回正</span>
        </div>
      </div>
    </div>

    <!-- Cockpit overlay (visible when playing) -->
    <div v-if="isPointerLocked" class="cockpit-overlay">
      <div class="crosshair">
        <div class="crosshair-line top"></div>
        <div class="crosshair-line bottom"></div>
        <div class="crosshair-line left"></div>
        <div class="crosshair-line right"></div>
        <div class="crosshair-dot"></div>
      </div>
    </div>

    <Minimap
      v-if="isPointerLocked"
      :player-pos="minimapPlayerPos"
      :player-rotation="minimapPlayerRotation"
    />

    <GameHUD
      :game-state="hudGameState"
      :wave-state="hudWaveState"
      :player-health="hudPlayerHealth"
      :player-max-health="hudPlayerMaxHealth"
      :player-rotation="hudPlayerRotation"
      :player-turret-rotation="hudPlayerTurretRotation"
      :on-restart="handleRestart"
    />
  </div>
</template>

<style scoped>
.game-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.click-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgba(0,20,0,0.3) 0%, rgba(0,0,0,0.6) 100%);
  color: white;
  font-size: 1.5rem;
  z-index: 10;
  pointer-events: none;
}

.click-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 48px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.click-icon {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(76, 175, 80, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(76, 175, 80, 0.6));
  }
}

.click-title {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: 4px;
  text-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
  margin: 0;
}

.click-subtitle {
  font-size: 0.85rem;
  opacity: 0.5;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin: 0;
}

.click-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 16px;
  margin-top: 8px;
}

.key-hint {
  font-size: 0.75rem;
  opacity: 0.6;
  white-space: nowrap;
}

.key-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 1px;
  font-size: 0.7rem;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.8);
  min-width: 18px;
  text-align: center;
}

/* ── Cockpit viewport overlay ── */
.cockpit-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  background:
    radial-gradient(ellipse 85% 75% at 50% 55%, transparent 60%, rgba(0,0,0,0.6) 100%);
}

/* ── Crosshair ── */
.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
}

.crosshair-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.7);
}

.crosshair-line.top    { top: 0; left: 50%; transform: translateX(-50%); width: 2px; height: 10px; }
.crosshair-line.bottom { bottom: 0; left: 50%; transform: translateX(-50%); width: 2px; height: 10px; }
.crosshair-line.left   { left: 0; top: 50%; transform: translateY(-50%); width: 10px; height: 2px; }
.crosshair-line.right  { right: 0; top: 50%; transform: translateY(-50%); width: 10px; height: 2px; }

.crosshair-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
}
</style>
