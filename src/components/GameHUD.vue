<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { WaveState } from '../game/systems/GameState'
import { GameState } from '../game/systems/GameState'

const props = defineProps<{
  gameState: string
  waveState: WaveState
  playerHealth: number
  playerMaxHealth: number
  playerRotation: number
  playerTurretRotation: number
  onRestart: () => void
}>()

// Wave clear animation state
const waveClearVisible = ref(false)
const waveClearText = ref('')

watch(() => props.gameState, (newState) => {
  if (newState === GameState.WAVE_CLEAR) {
    waveClearText.value = `WAVE ${props.waveState.currentWave} CLEAR!`
    waveClearVisible.value = true
    setTimeout(() => { waveClearVisible.value = false }, 2000)
  } else {
    waveClearVisible.value = false
  }
})

// Compass rotation: chassis arrow rotates by -turretRotation relative to turret (always up)
const chassisAngleDeg = computed(() => {
  return -(props.playerTurretRotation * 180 / Math.PI)
})

// Health bar color gradient from green to red
const healthPercent = computed(() => {
  if (props.playerMaxHealth <= 0) return 0
  return Math.max(0, Math.min(100, (props.playerHealth / props.playerMaxHealth) * 100))
})

const healthColor = computed(() => {
  const pct = healthPercent.value / 100
  if (pct > 0.6) return '#4CAF50'
  if (pct > 0.3) return '#FFC107'
  return '#f44336'
})

const healthGradient = computed(() => {
  const pct = healthPercent.value / 100
  const r = Math.round(76 + (244 - 76) * (1 - pct))
  const g = Math.round(175 + (67 - 175) * (1 - pct))
  return `rgb(${r}, ${g}, 80)`
})
</script>

<template>
  <div class="hud">
    <!-- ─── Health bar — top left ─── -->
    <div class="health-panel">
      <div class="health-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="health-icon">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" opacity="0.9"/>
        </svg>
        <span class="health-label">HP</span>
      </div>
      <div class="health-track">
        <div
          class="health-fill"
          :style="{
            width: healthPercent + '%',
            background: `linear-gradient(90deg, ${healthColor}, ${healthGradient})`,
          }"
        />
        <div class="health-shine" />
      </div>
      <div class="health-text">{{ playerHealth }}<span class="health-sep">/</span>{{ playerMaxHealth }}</div>
    </div>

    <!-- ─── Compass — bottom center ─── -->
    <div class="compass-panel">
      <div class="compass-ring">
        <!-- Tick marks -->
        <svg class="compass-ticks" viewBox="0 0 80 80" width="80" height="80">
          <g v-for="i in 12" :key="i">
            <line
              :x1="40 + 34 * Math.sin(2 * Math.PI * i / 12)"
              :y1="40 - 34 * Math.cos(2 * Math.PI * i / 12)"
              :x2="40 + 38 * Math.sin(2 * Math.PI * i / 12)"
              :y2="40 - 38 * Math.cos(2 * Math.PI * i / 12)"
              stroke="rgba(255,255,255,0.4)"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </g>
        </svg>
        <!-- Chassis direction arrow (green, rotates) -->
        <div
          class="compass-arrow chassis-arrow"
          :style="{ transform: `translate(-50%, -50%) rotate(${chassisAngleDeg}deg)` }"
        >
          <svg width="28" height="36" viewBox="0 0 28 36">
            <polygon points="14,0 0,36 14,28 28,36" fill="rgba(76,175,80,0.9)" stroke="rgba(76,175,80,1)" stroke-width="1"/>
          </svg>
        </div>
        <!-- Turret direction arrow (white outline, always up) -->
        <div class="compass-arrow turret-arrow">
          <svg width="22" height="30" viewBox="0 0 22 30">
            <polygon points="11,0 0,30 11,22 22,30" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>
          </svg>
        </div>
        <!-- Center dot -->
        <div class="compass-dot" />
      </div>
      <div class="compass-label">方向</div>
    </div>

    <!-- ─── Stats — top right ─── -->
    <div class="stats">
      <div class="stats-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="stats-icon">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.6"/>
          <path d="M12 6v6l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        </svg>
        <span>战报</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">波次</span>
        <span class="stat-value wave-value">{{ String(waveState.currentWave).padStart(2, '0') }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">分数</span>
        <span class="stat-value">{{ waveState.score }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">击杀</span>
        <span class="stat-value kill-value">{{ waveState.kills }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">敌人</span>
        <span class="stat-value">{{ waveState.enemiesAlive }}<span class="stat-sep">/</span>{{ waveState.enemiesTotal }}</span>
      </div>
      <div class="stat-divider" />
      <div class="stat-hint">
        <kbd>ESC</kbd> 暂停
        <kbd>Space</kbd> 回正
      </div>
    </div>

    <!-- ─── Wave clear notification — center ─── -->
    <Transition name="wave-clear">
      <div v-if="waveClearVisible" class="wave-clear-overlay">
        <div class="wave-clear-glow" />
        <div class="wave-clear-text">{{ waveClearText }}</div>
        <div class="wave-clear-sub">准备下一波...</div>
      </div>
    </Transition>

    <!-- ─── Game over overlay — full screen ─── -->
    <div v-if="gameState === 'GAME_OVER'" class="game-over-overlay">
      <div class="game-over-bg" />
      <div class="game-over-content">
        <div class="game-over-title">GAME OVER</div>
        <div class="game-over-divider" />
        <div class="game-over-stats">
          <div class="go-stat">
            <span class="go-stat-label">分数</span>
            <span class="go-stat-value">{{ waveState.score }}</span>
          </div>
          <div class="go-stat">
            <span class="go-stat-label">击杀</span>
            <span class="go-stat-value">{{ waveState.kills }}</span>
          </div>
          <div class="go-stat">
            <span class="go-stat-label">波次</span>
            <span class="go-stat-value">{{ waveState.currentWave }}</span>
          </div>
        </div>
        <button class="restart-btn" @click="onRestart">
          <span class="restart-icon">⟳</span>
          重新开始
        </button>
        <div class="game-over-hint">按 <kbd>R</kbd> 重新开始</div>
      </div>
    </div>

    <!-- ─── Pause overlay ─── -->
    <div v-if="gameState === 'PAUSED'" class="pause-overlay">
      <div class="pause-bg" />
      <div class="pause-content">
        <div class="pause-text">已暂停</div>
        <div class="pause-divider" />
        <div class="pause-hint">按 <kbd>ESC</kbd> 继续</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: white;
  z-index: 10;
}

/* ───────── Health Panel — top left ───────── */
.health-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.health-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.health-icon {
  color: #f44336;
  filter: drop-shadow(0 0 4px rgba(244, 67, 54, 0.4));
}

.health-label {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
  opacity: 0.8;
}

.health-track {
  position: relative;
  width: 140px;
  height: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease, background 0.3s ease;
  position: relative;
  z-index: 1;
}

.health-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
  z-index: 2;
  pointer-events: none;
}

.health-text {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  opacity: 0.9;
  min-width: 40px;
  text-align: right;
}

.health-sep {
  opacity: 0.3;
  margin: 0 1px;
}

/* ───────── Compass — bottom center ───────── */
.compass-panel {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.compass-ring {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.compass-ticks {
  position: absolute;
  inset: 0;
}

.compass-arrow {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease-out;
}

.chassis-arrow {
  z-index: 2;
  filter: drop-shadow(0 0 6px rgba(76, 175, 80, 0.5));
}

.turret-arrow {
  z-index: 3;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
}

.compass-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  z-index: 4;
}

.compass-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.4;
}

/* ───────── Stats — top right ───────── */
.stats {
  position: absolute;
  top: 16px;
  right: 16px;
  min-width: 150px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.5;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.stats-icon {
  color: rgba(255, 255, 255, 0.5);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
  font-size: 13px;
  line-height: 1.6;
}

.stat-label {
  opacity: 0.6;
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.stat-value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-sep {
  opacity: 0.3;
  margin: 0 2px;
}

.wave-value {
  color: #FFD700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

.kill-value {
  color: #f44336;
}

.stat-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 6px 0;
}

.stat-hint {
  font-size: 10px;
  opacity: 0.35;
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 2px;
}

.stat-hint kbd {
  display: inline-block;
  padding: 0 5px;
  font-size: 9px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
}

/* ───────── Wave clear overlay ───────── */
.wave-clear-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 20;
}

.wave-clear-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.12) 0%, transparent 70%);
  animation: wave-glow-pulse 1.5s ease-in-out infinite;
}

@keyframes wave-glow-pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 1; }
}

.wave-clear-text {
  font-size: 52px;
  font-weight: 800;
  color: #FFD700;
  text-shadow:
    0 0 30px rgba(255, 215, 0, 0.6),
    0 0 60px rgba(255, 215, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 6px;
  animation: wave-text-enter 0.5s ease-out;
  z-index: 1;
}

@keyframes wave-text-enter {
  0% { transform: scale(2); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.wave-clear-sub {
  font-size: 14px;
  opacity: 0.5;
  letter-spacing: 4px;
  margin-top: 8px;
  z-index: 1;
}

/* Wave clear transition */
.wave-clear-enter-active { transition: opacity 0.3s ease; }
.wave-clear-leave-active { transition: opacity 0.6s ease; }
.wave-clear-enter-from,
.wave-clear-leave-to { opacity: 0; }

/* ───────── Game Over overlay ───────── */
.game-over-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}

.game-over-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(180, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.75) 100%);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.game-over-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 56px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(244, 67, 54, 0.25);
  border-radius: 20px;
  box-shadow:
    0 0 40px rgba(244, 67, 54, 0.15),
    0 8px 32px rgba(0, 0, 0, 0.5);
  animation: go-enter 0.5s ease-out;
}

@keyframes go-enter {
  0% { transform: translateY(20px) scale(0.95); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

.game-over-title {
  font-size: 56px;
  font-weight: 900;
  color: #f44336;
  letter-spacing: 12px;
  text-shadow:
    0 0 30px rgba(244, 67, 54, 0.5),
    0 0 60px rgba(244, 67, 54, 0.2);
  margin-bottom: 8px;
}

.game-over-divider {
  width: 120px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(244, 67, 54, 0.5), transparent);
  margin-bottom: 24px;
}

.game-over-stats {
  display: flex;
  gap: 32px;
  margin-bottom: 32px;
}

.go-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.go-stat-label {
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.4;
}

.go-stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #FFD700;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
  font-variant-numeric: tabular-nums;
}

.restart-btn {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 40px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.8), rgba(56, 142, 60, 0.9));
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.2);
}

.restart-btn:hover {
  background: linear-gradient(135deg, rgba(76, 175, 80, 1), rgba(56, 142, 60, 1));
  box-shadow: 0 4px 24px rgba(76, 175, 80, 0.4);
  transform: translateY(-1px);
}

.restart-icon {
  font-size: 20px;
}

.game-over-hint {
  margin-top: 12px;
  font-size: 11px;
  opacity: 0.35;
  letter-spacing: 1px;
}

.game-over-hint kbd {
  display: inline-block;
  padding: 0 5px;
  font-size: 10px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
}

/* ───────── Pause overlay ───────── */
.pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 25;
}

.pause-bg {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.pause-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 48px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  animation: pause-enter 0.2s ease-out;
}

@keyframes pause-enter {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.pause-text {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 8px;
  opacity: 0.8;
}

.pause-divider {
  width: 80px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  margin: 12px 0;
}

.pause-hint {
  font-size: 13px;
  opacity: 0.4;
  letter-spacing: 1px;
}

.pause-hint kbd {
  display: inline-block;
  padding: 0 6px;
  font-size: 11px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
