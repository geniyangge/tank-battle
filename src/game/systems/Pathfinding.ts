/**
 * A* pathfinding system for the 20×20 maze tank battle game.
 *
 * The maze grid uses MAZE_DATA[row][col]:
 *   row = z axis, col = x axis
 *   0 = open path, 1 = wall
 *
 * Movement is 4-directional (up/down/left/right) — no diagonal moves.
 * Manhattan distance is used for the heuristic.
 *
 * The returned path is an array of {x, z} grid coordinates from start
 * to end (inclusive of both ends when a path exists).
 */

/** A node in the A* search graph. */
export interface GridNode {
  x: number
  z: number
  g: number
  h: number
  f: number
  parent: GridNode | null
}

/** 4-directional offsets: right, left, down, up. */
const DIRECTIONS: ReadonlyArray<{ readonly x: number; readonly z: number }> = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
]

/**
 * Manhattan distance heuristic for a grid.
 * Returns |x1 - x2| + |z1 - z2|.
 */
function manhattan(x1: number, z1: number, x2: number, z2: number): number {
  return Math.abs(x1 - x2) + Math.abs(z1 - z2)
}

/**
 * Build a string key `"x,z"` from grid coordinates for use in sets/maps.
 */
function nodeKey(x: number, z: number): string {
  return `${x},${z}`
}

/**
 * Reconstruct the path by walking parent pointers from the end node
 * back to the start, then reversing so the result is start → end order.
 *
 * Both start and end nodes are included in the result.
 */
function reconstructPath(node: GridNode): { x: number; z: number }[] {
  const path: { x: number; z: number }[] = []
  let current: GridNode | null = node
  while (current !== null) {
    path.push({ x: current.x, z: current.z })
    current = current.parent
  }
  path.reverse()
  return path
}

/**
 * Find the lowest-f node in the open set.
 *
 * Returns the index and the node.  This is a linear scan — fine for
 * a 20×20 grid (≤ 400 nodes); a binary-heap open set is unnecessary
 * at this scale.
 */
function findLowestF(openSet: GridNode[]): { index: number; node: GridNode } {
  let lowestIndex = 0
  let lowestNode = openSet[0]
  for (let i = 1; i < openSet.length; i++) {
    const candidate = openSet[i]
    // Tie-break by lower h (Bresenham-like bias toward the goal)
    if (candidate.f < lowestNode.f || (candidate.f === lowestNode.f && candidate.h < lowestNode.h)) {
      lowestIndex = i
      lowestNode = candidate
    }
  }
  return { index: lowestIndex, node: lowestNode }
}

/**
 * Run A* pathfinding on a maze grid.
 *
 * @param startCol  Starting column (x-coordinate in grid space).
 * @param startRow  Starting row (z-coordinate in grid space).
 * @param endCol    Target column.
 * @param endRow    Target row.
 * @param grid      The maze grid: `grid[row][col]` — `0` = open, `1` = wall.
 * @returns An array of `{x, z}` grid positions from start to end, or an
 *          empty array if no path exists.
 */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  grid: ReadonlyArray<ReadonlyArray<number>>,
): { x: number; z: number }[] {
  // ---- Edge-case guards ----

  // Out of bounds
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  if (
    startRow < 0 || startRow >= rows ||
    startCol < 0 || startCol >= cols ||
    endRow < 0 || endRow >= rows ||
    endCol < 0 || endCol >= cols
  ) {
    return []
  }

  // Start or end is a wall
  if (grid[startRow][startCol] === 1 || grid[endRow][endCol] === 1) {
    return []
  }

  // Start equals end
  if (startCol === endCol && startRow === endRow) {
    return [{ x: startCol, z: startRow }]
  }

  // ---- Initialise open / closed sets ----

  const openSet: GridNode[] = []
  const closedSet = new Set<string>()

  const startNode: GridNode = {
    x: startCol,
    z: startRow,
    g: 0,
    h: manhattan(startCol, startRow, endCol, endRow),
    f: 0,
    parent: null,
  }
  startNode.f = startNode.g + startNode.h
  openSet.push(startNode)

  // ---- Main loop ----

  while (openSet.length > 0) {
    const { index, node: current } = findLowestF(openSet)

    // Goal check
    if (current.x === endCol && current.z === endRow) {
      return reconstructPath(current)
    }

    // Move current from open to closed
    // Swap-remove (O(1)) — order in openSet does not matter
    openSet[index] = openSet[openSet.length - 1]
    openSet.pop()
    closedSet.add(nodeKey(current.x, current.z))

    // Explore neighbours
    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.x
      const nz = current.z + dir.z

      // Bounds check
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue

      // Wall check
      if (grid[nz][nx] === 1) continue

      // Already closed
      const key = nodeKey(nx, nz)
      if (closedSet.has(key)) continue

      const tentativeG = current.g + 1

      // Find existing open node, if any
      const existingIndex = openSet.findIndex(n => n.x === nx && n.z === nz)

      if (existingIndex === -1) {
        // Not in open set — add it
        const neighbor: GridNode = {
          x: nx,
          z: nz,
          g: tentativeG,
          h: manhattan(nx, nz, endCol, endRow),
          f: tentativeG + manhattan(nx, nz, endCol, endRow),
          parent: current,
        }
        openSet.push(neighbor)
      } else {
        // Already in open set — update if this path is better
        const existing = openSet[existingIndex]
        if (tentativeG < existing.g) {
          existing.g = tentativeG
          existing.f = tentativeG + existing.h
          existing.parent = current
        }
      }
    }
  }

  // Open set exhausted — no path exists
  return []
}

/**
 * Debug helper: render a path as a visual 20×20 character grid.
 *
 * Open cells are shown as `·`, path cells as `●`.
 * Useful for console-logging path shapes during development.
 *
 * @param path  The path array from `findPath`.
 * @returns A 20×20 grid of characters, each row joined into a string.
 */
export function visualizePath(path: ReadonlyArray<{ x: number; z: number }>): string[] {
  const grid: string[][] = Array.from({ length: 20 }, () => Array<string>(20).fill('·'))
  for (const node of path) {
    grid[node.z][node.x] = '●'
  }
  return grid.map(r => r.join(' '))
}
