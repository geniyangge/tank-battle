/**
 * Web Audio API procedural sound effects system.
 *
 * All sounds are synthesized at runtime — no external audio files needed.
 * AudioContext is lazily created on first use (must be after a user gesture).
 */
export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private volume = 0.3

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  private getGain(): GainNode {
    this.ensureContext()
    return this.masterGain!
  }

  /** Short gunshot — high-frequency square-wave burst */
  playShoot(): void {
    const ctx = this.ensureContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1)

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(this.getGain())
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  }

  /** Explosion — low sawtooth rumble + white noise texture */
  playExplosion(): void {
    const ctx = this.ensureContext()

    // Low rumble oscillator
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(100, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4)

    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

    osc.connect(gain)
    gain.connect(this.getGain())
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)

    // Noise burst for extra texture
    this.playNoiseBurst(0.3, 0.2)
  }

  /** Bullet hit — medium triangle-wave impact */
  playHit(): void {
    const ctx = this.ensureContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(400, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08)

    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

    osc.connect(gain)
    gain.connect(this.getGain())
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
  }

  /** Wave clear — ascending triumphant arpeggio (C5-E5-G5-C6) */
  playWaveClear(): void {
    const ctx = this.ensureContext()
    const notes = [523, 659, 784, 1047] // C5, E5, G5, C6

    for (const [i, freq] of notes.entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq

      const startTime = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)

      osc.connect(gain)
      gain.connect(this.getGain())
      osc.start(startTime)
      osc.stop(startTime + 0.3)
    }
  }

  /** Game over — descending sad tone (400→350→300→200) */
  playGameOver(): void {
    const ctx = this.ensureContext()
    const notes = [400, 350, 300, 200]

    for (const [i, freq] of notes.entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq

      const startTime = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4)

      osc.connect(gain)
      gain.connect(this.getGain())
      osc.start(startTime)
      osc.stop(startTime + 0.4)
    }
  }

  /** White noise burst helper (used as explosion texture) */
  private playNoiseBurst(duration: number, volume: number): void {
    const ctx = this.ensureContext()
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, ctx.currentTime)

    source.connect(gain)
    gain.connect(this.getGain())
    source.start()
  }

  /** Set master volume (0–1) */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume
    }
  }
}

// Module-level singleton
let instance: AudioManager | null = null

export function getAudioManager(): AudioManager {
  if (!instance) {
    instance = new AudioManager()
  }
  return instance
}
