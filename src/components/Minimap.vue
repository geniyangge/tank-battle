<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { MAZE_DATA, MAP_ROWS, MAP_COLS } from '../game/constants'

const props = defineProps<{
  playerPos: { x: number; y: number; z: number }
  playerRotation: number  // chassis rotation in radians
  viewportSize?: number   // visible grid cells per axis (default 9)
}>()

const canvasRef = ref<HTMLCanvasElement>()
const SIZE = 180  // px

let animId = 0

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const S = SIZE
  const viewportSize = props.viewportSize ?? 9
  const T = S / viewportSize  // pixels per cell

  // ── Player grid position ──
  // World → grid: col = Math.round(x + 9.5), row = Math.round(z + 9.5)
  const col = Math.round(props.playerPos.x + 9.5)
  const row = Math.round(props.playerPos.z + 9.5)

  // ── Viewport bounds (centered on player) ──
  const halfView = Math.floor(viewportSize / 2)
  const startCol = col - halfView
  const startRow = row - halfView

  // Clamp wall rendering to map boundaries (0–19)
  const renderStartCol = Math.max(0, startCol)
  const renderStartRow = Math.max(0, startRow)
  const renderEndCol = Math.min(MAP_COLS, startCol + viewportSize)
  const renderEndRow = Math.min(MAP_ROWS, startRow + viewportSize)

  // ── Clear ──
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, S, S)

  // ── Walls (only within viewport) ──
  ctx.fillStyle = '#4a4a6a'
  for (let r = renderStartRow; r < renderEndRow; r++) {
    for (let c = renderStartCol; c < renderEndCol; c++) {
      if (MAZE_DATA[r][c] === 1) {
        const px = (c - startCol) * T
        const py = (r - startRow) * T
        ctx.fillRect(px, py, T, T)
      }
    }
  }

  // ── Grid lines (subtle, for viewport only) ──
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= viewportSize; i++) {
    ctx.beginPath(); ctx.moveTo(i * T, 0); ctx.lineTo(i * T, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * T); ctx.lineTo(S, i * T); ctx.stroke()
  }

  // ── Player arrow (always at canvas center) ──
  const angle = props.playerRotation  // radians, Y-up
  const arrowLen = T * 0.8

  ctx.save()
  ctx.translate(S / 2, S / 2)
  ctx.rotate(-angle + Math.PI / 2)  // Three.js rotation → canvas rotation

  // Triangle pointing "up" in canvas coordinates
  ctx.beginPath()
  ctx.moveTo(0, -arrowLen)
  ctx.lineTo(-arrowLen * 0.5, arrowLen * 0.5)
  ctx.lineTo(arrowLen * 0.5, arrowLen * 0.5)
  ctx.closePath()

  ctx.fillStyle = '#4CAF50'
  ctx.fill()
  ctx.strokeStyle = '#66BB6A'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()

  // ── Border ──
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, S, S)

  animId = requestAnimationFrame(draw)
}

onMounted(() => {
  animId = requestAnimationFrame(draw)
})

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId)
})
</script>

<template>
  <div class="minimap">
    <canvas
      ref="canvasRef"
      :width="SIZE"
      :height="SIZE"
    />
  </div>
</template>

<style scoped>
.minimap {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.5);
  opacity: 0.85;
  pointer-events: none;
}
.minimap canvas {
  display: block;
}
</style>
