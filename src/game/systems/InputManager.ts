import type { InputSnapshot } from '../types'

export class InputManager {
  private static instance: InputManager

  private keys: Set<string> = new Set()
  private mouseDeltaX = 0
  private mouseDeltaY = 0
  private mouseButtons: Set<number> = new Set()
  private isPointerLocked = false
  private snapshot: InputSnapshot = { keys: new Set(), mouseDelta: { x: 0, y: 0 }, mouseButtons: new Set() }

  // Private bound handlers for cleanup in dispose()
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (this.isPointerLocked) {
      this.mouseDeltaX += event.movementX
      this.mouseDeltaY += event.movementY
    }
  }

  private readonly handleMouseDown = (event: MouseEvent): void => {
    this.mouseButtons.add(event.button)
  }

  private readonly handleMouseUp = (event: MouseEvent): void => {
    this.mouseButtons.delete(event.button)
  }

  private readonly handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement !== null
  }

  private readonly handlePointerLockError = (): void => {
    this.isPointerLocked = false
  }

  private constructor() {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('mousemove', this.handleMouseMove)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('pointerlockchange', this.handlePointerLockChange)
    window.addEventListener('pointerlockerror', this.handlePointerLockError)
  }

  static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager()
    }
    return InputManager.instance
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code)
  }

  getMouseDelta(): { x: number; y: number } {
    return { x: this.mouseDeltaX, y: this.mouseDeltaY }
  }

  isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.has(button)
  }

  isPointerLockedStatus(): boolean {
    return this.isPointerLocked
  }

  update(): void {
    // Snapshot current state
    this.snapshot = {
      keys: new Set(this.keys),
      mouseDelta: { x: this.mouseDeltaX, y: this.mouseDeltaY },
      mouseButtons: new Set(this.mouseButtons),
    }

    // Reset frame-based deltas
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
  }

  getSnapshot(): InputSnapshot {
    return this.snapshot
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('mousemove', this.handleMouseMove)
    window.removeEventListener('mousedown', this.handleMouseDown)
    window.removeEventListener('mouseup', this.handleMouseUp)
    window.removeEventListener('pointerlockchange', this.handlePointerLockChange)
    window.removeEventListener('pointerlockerror', this.handlePointerLockError)
  }

  requestPointerLock(element: HTMLElement): void {
    element.requestPointerLock()
  }
}
