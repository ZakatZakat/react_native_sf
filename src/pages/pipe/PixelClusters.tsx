/**
 * Shared blue pixel-cluster supergraphics used as background decoration in
 * PipeLandingPage variant D and the matching onboarding variant.
 *
 * Each cluster is a hand-tuned 2-D 0/1 array rendered as chunky <rect> cells
 * with a sub-pixel gap (white grid comes from the page background showing
 * through). Each filled cell animates as part of a perimeter "spotlight"
 * that orbits the silhouette.
 */

import * as React from "react"
import { useMemo } from "react"
import { Box } from "@chakra-ui/react"

const B = "#0055FF"

export const TOP_LEFT_GRID = [
  [1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1, 0, 0, 0],
  [1, 1, 1, 1, 1, 0, 0, 0],
  [1, 1, 1, 0, 1, 0, 0, 0],
  [1, 1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 0],
]

export const MID_RIGHT_GRID = [
  [1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1],
  [1, 0, 1, 1, 1],
  [1, 1, 1, 1, 1],
  [1, 1, 1, 0, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1],
  [0, 1, 1, 1, 1],
]

export const BOTTOM_RIGHT_GRID = [
  [0, 0, 1, 1, 1, 1, 1, 1],
  [0, 0, 1, 1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1, 1, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
]

export const BOTTOM_LEFT_GRID = [
  [0, 0, 0, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 1, 1, 1, 0, 0],
]

const ROTATE_DURATION_MS = 4200

export function PixelCluster({
  grid,
  color = B,
  shimmerSeed = 0,
}: {
  grid: number[][]
  color?: string
  shimmerSeed?: number
}) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  const cellMeta = useMemo(() => {
    let sumX = 0, sumY = 0, n = 0
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) { sumX += x; sumY += y; n++ }
      }
    }
    const cx = n ? sumX / n : cols / 2
    const cy = n ? sumY / n : rows / 2
    const meta: Array<Array<{ isEdge: boolean; delayMs: number }>> = []
    for (let y = 0; y < rows; y++) {
      const row: Array<{ isEdge: boolean; delayMs: number }> = []
      for (let x = 0; x < cols; x++) {
        let isEdge = false
        if (grid[y][x] === 1) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const ny = y + dy, nx = x + dx
            if (ny < 0 || ny >= rows || nx < 0 || nx >= cols || grid[ny][nx] !== 1) {
              isEdge = true
              break
            }
          }
        }
        const angle = Math.atan2(y - cy, x - cx)
        const norm = (angle + Math.PI) / (2 * Math.PI)
        const delayMs = -Math.round(norm * ROTATE_DURATION_MS) + shimmerSeed
        row.push({ isEdge, delayMs })
      }
      meta.push(row)
    }
    return meta
  }, [grid, rows, cols, shimmerSeed])

  return (
    <svg
      viewBox={`0 0 ${cols * 10} ${rows * 10}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <style>{`
        @keyframes edge-orbit {
          0%   { opacity: 0.35; }
          18%  { opacity: 1;    }
          36%  { opacity: 0.65; }
          100% { opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          .edge-cell { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
      {grid.map((row, y) =>
        row.map((cell, x) => {
          if (cell !== 1) return null
          const { isEdge, delayMs } = cellMeta[y][x]
          return (
            <rect
              key={`${x}-${y}`}
              className={isEdge ? "edge-cell" : undefined}
              x={x * 10}
              y={y * 10}
              width="10"
              height="10"
              fill={color}
              style={
                isEdge
                  ? {
                      animation: `edge-orbit ${ROTATE_DURATION_MS}ms linear infinite`,
                      animationDelay: `${delayMs}ms`,
                    }
                  : undefined
              }
            />
          )
        })
      )}
    </svg>
  )
}

/**
 * Renders all 4 corner clusters with sensible default positions / sizes.
 * Both PipeLandingPage variant D and onboarding "Bento" variant use this.
 */
export function PixelClusterBackdrop() {
  return (
    <>
      <Box
        position="absolute"
        top={{ base: "-44px", sm: "-30px" }}
        left={{ base: "-44px", sm: "-30px" }}
        w={{ base: `${TOP_LEFT_GRID[0].length * 14}px`, sm: `${TOP_LEFT_GRID[0].length * 26}px` }}
        h={{ base: `${TOP_LEFT_GRID.length * 14}px`, sm: `${TOP_LEFT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.95}
      >
        <PixelCluster grid={TOP_LEFT_GRID} color={B} shimmerSeed={0} />
      </Box>
      <Box
        position="absolute"
        top={{ base: "300px", sm: "400px" }}
        right={{ base: "-30px", sm: "-20px" }}
        w={{ base: `${MID_RIGHT_GRID[0].length * 14}px`, sm: `${MID_RIGHT_GRID[0].length * 26}px` }}
        h={{ base: `${MID_RIGHT_GRID.length * 14}px`, sm: `${MID_RIGHT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.9}
      >
        <PixelCluster grid={MID_RIGHT_GRID} color={B} shimmerSeed={400} />
      </Box>
      <Box
        position="absolute"
        bottom={{ base: "140px", sm: "160px" }}
        left={{ base: "-30px", sm: "0" }}
        w={{ base: `${BOTTOM_LEFT_GRID[0].length * 14}px`, sm: `${BOTTOM_LEFT_GRID[0].length * 26}px` }}
        h={{ base: `${BOTTOM_LEFT_GRID.length * 14}px`, sm: `${BOTTOM_LEFT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.85}
      >
        <PixelCluster grid={BOTTOM_LEFT_GRID} color={B} shimmerSeed={900} />
      </Box>
      <Box
        position="absolute"
        bottom={{ base: "-30px", sm: "0" }}
        right={{ base: "-30px", sm: "0" }}
        w={{ base: `${BOTTOM_RIGHT_GRID[0].length * 14}px`, sm: `${BOTTOM_RIGHT_GRID[0].length * 26}px` }}
        h={{ base: `${BOTTOM_RIGHT_GRID.length * 14}px`, sm: `${BOTTOM_RIGHT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.95}
      >
        <PixelCluster grid={BOTTOM_RIGHT_GRID} color={B} shimmerSeed={1500} />
      </Box>
    </>
  )
}
