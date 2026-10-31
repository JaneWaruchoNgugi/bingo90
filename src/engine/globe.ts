import { BALLS, LITE, colorOf } from '../game/constants'

/**
 * The ball machine: a wide glass globe of 90 balls tossed by air from below, on a layered
 * pedestal. A drawn ball is sucked down into the central riser, rises to the neck at the top of
 * the globe and rides one of seven glass pipes up to its slot in the capsule tray on top. Sizes
 * are in machine units: the canvas covers W × H units, scaled to the screen.
 */
export const W = 500
export const H = 715
/** empty margin drawn around the machine so glows fade out instead of being cut off at the canvas edge */
export const PAD = 36
const CX = W / 2
const CY = 408
const RX = 238
const RY = 220
/** the globe is a 3D ellipsoid: RZ is its depth, towards and away from the viewer */
const RZ = 200
/** a ball's radius; balls nearer the viewer are drawn up to DEPTH_K bigger, those behind smaller and darker */
const BR = 26
const DEPTH_K = 0.16
const DRAW_K = 1
/** the seven outlets: a slot in the tray on top for each, fed by its own pipe from the neck */
export const OUTLETS = 7
const TRAY = { x: 10, y: 12, w: W - 20, h: 100 }
const SLOT_Y = TRAY.y + TRAY.h / 2
const SLOT_R = 29
const SLOT_GAP = 64
const SLOT_COLS = ['#3b82f6', '#f59e0b', '#d946ef', '#22c55e', '#ef4444', '#06b6d4', '#ec4899']
const slotX = (i: number) => CX + (i - (OUTLETS - 1) / 2) * SLOT_GAP
/** the neck on top of the globe, where all seven pipes leave */
const NECK_Y = CY - RY + 2
const PIPE_Y = NECK_Y - 14
const PIPE_W = 34
/** the central riser: a short glass tube hanging from the neck into the top of the globe */
const RISE_BOT = CY - RY * 0.35
/** a ball in a pipe is a little smaller than in the globe; in the tray it is bigger */
const PIPE_K = 0.6
const TRAY_K = (SLOT_R - 1) / BR

/** pipe i as a cubic Bézier from the neck to the centre of slot i */
const pipe = (i: number) => {
  const x0 = CX + (i - 3) * 8
  const x3 = slotX(i)
  return [x0, PIPE_Y, x0, PIPE_Y - 40, x3, SLOT_Y + 64, x3, SLOT_Y] as const
}
const bez = (t: readonly number[], k: number) => {
  const u = 1 - k
  const a = u * u * u
  const b = 3 * u * u * k
  const c = 3 * u * k * k
  const d = k * k * k
  return { x: a * t[0] + b * t[2] + c * t[4] + d * t[6], y: a * t[1] + b * t[3] + c * t[5] + d * t[7] }
}

const STEP = 1000 / 60
const T_IN = 160
const T_RISE = 170
const T_PIPE = 380

export interface Ball {
  n: number
  x: number
  y: number
  vx: number
  vy: number
  /** depth: + towards the viewer */
  z: number
  vz: number
  /** spin of the number face, from rolling */
  a: number
  pick?: { t0: number; sx: number; sy: number; slot: number; cb: () => void }
}

/** Physics state shared by the game (which asks for balls) and the canvas renderer. */
export class GlobeState {
  balls: Ball[] = []
  /** true while the blower runs at full power */
  busy = false
  /** how hard the blower is running right now, 0–1; follows busy */
  power = 0
  /** the ball sitting in each slot of the tray (0 = empty) */
  slots: number[] = Array(OUTLETS).fill(0)
  private next = 0

  constructor() {
    this.reset()
  }

  reset() {
    this.slots = Array(OUTLETS).fill(0)
    this.next = 0
    this.balls = Array.from({ length: BALLS }, (_, i) => {
      return {
        n: i + 1,
        x: CX + (Math.random() - 0.5) * RX,
        y: CY + Math.random() * RY * 0.6,
        z: (Math.random() - 0.5) * RZ,
        vx: Math.random() * 2 - 1,
        vy: 0,
        vz: 0,
        a: Math.random() * 6.28,
      }
    })
  }

  /** Sends ball `n` up the next pipe, left to right; `cb` fires when it sits in its slot. After seven, the slots empty and fill again. */
  pick(n: number, cb: () => void) {
    const slot = this.next++ % OUTLETS
    let b = this.balls.find(x => x.n === n && !x.pick)
    if (!b) {
      b = { n, x: CX, y: CY, z: 0, vx: 0, vy: 0, vz: 0, a: 0 }
      this.balls.push(b)
    }
    b.pick = {
      t0: performance.now(),
      sx: b.x,
      sy: b.y,
      slot,
      cb: () => {
        // a new set of seven starts with an empty tray
        if (slot === 0) this.slots = Array(OUTLETS).fill(0)
        this.slots[slot] = n
        cb()
      },
    }
  }
}

/** 0–1: how lively bounces are; low while the blower is off so the pile settles still */
let bounce = 1

function contain(b: Ball) {
  const a = RX - BR - 4
  const c = RY - BR - 4
  const e = RZ - BR - 4
  const ex = (b.x - CX) / a
  const ey = (b.y - CY) / c
  const ez = b.z / e
  const d = Math.sqrt(ex * ex + ey * ey + ez * ez)
  if (d <= 1) return
  b.x = CX + (ex / d) * a
  b.y = CY + (ey / d) * c
  b.z = (ez / d) * e
  // the wall's normal on an ellipsoid
  let nx = ex / a
  let ny = ey / c
  let nz = ez / e
  const l = Math.sqrt(nx * nx + ny * ny + nz * nz)
  nx /= l
  ny /= l
  nz /= l
  const vn = b.vx * nx + b.vy * ny + b.vz * nz
  if (vn > 0) {
    // the bottom of the bowl soaks up more of the bounce than the sides
    const k = 1 + (ny > 0.6 ? 0.45 : 0.75) * bounce
    b.vx -= k * vn * nx
    b.vy -= k * vn * ny
    b.vz -= k * vn * nz
  }
}

function step(gs: GlobeState, t: number) {
  const free = gs.balls.filter(b => !b.pick)
  // the blower spins up and down smoothly instead of switching on and off
  gs.power += ((gs.busy ? 1 : 0) - gs.power) * (gs.busy ? 0.05 : 0.02)
  const air = gs.power
  bounce = Math.min(1, 0.15 + air * 1.5)
  const sx = Math.sin(t / 700) * 0.12
  const sz = Math.cos(t / 900) * 0.12
  for (const b of free) {
    b.vy += 0.36
    const dx = (b.x - CX) / RX
    const dy = (b.y - CY) / RY
    const dz = b.z / RZ
    const low = Math.min(1, Math.max(0, (dy + 0.1) / 0.9))
    if (air > 0.02) {
      // the jet: a narrow column of air from the bottom centre that fires balls up the middle
      const col = Math.exp(-((dx - sx) ** 2 + (dz - sz) ** 2) / 0.08)
      b.vy -= air * 2 * col * low * (0.6 + Math.random() * 0.8)
      // random bursts from the floor kick balls up off the pile
      if (low > 0.5 && Math.random() < 0.07 * air) {
        b.vy -= 5 + Math.random() * 6
        b.vx += (Math.random() - 0.5) * 7
        b.vz += (Math.random() - 0.5) * 7
      }
      // over the top the air spreads outwards, so balls rain down the sides
      if (dy < -0.3) {
        b.vx += air * dx * 0.14
        b.vz += air * dz * 0.14
      }
      b.vx += (Math.random() - 0.5) * 0.9 * air
      b.vz += (Math.random() - 0.5) * 0.9 * air
    }
    // drag: light in the air, heavy when resting on the pile so it settles still
    const k = air > 0.05 ? 0.994 : 0.97
    b.vx *= k
    b.vy *= k
    b.vz *= k
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz)
    if (sp > 15) {
      b.vx *= 15 / sp
      b.vy *= 15 / sp
      b.vz *= 15 / sp
    }
    b.x += b.vx
    b.y += b.vy
    b.z += b.vz
    // the face turns as the ball rolls and tumbles
    b.a += (b.vx * 0.8 + b.vy * 0.25 + b.vz * 0.3) / BR
    contain(b)
  }
  const D = BR * 2
  const rest = bounce < 0.5
  const before = rest ? free.map(b => [b.x - b.vx, b.y - b.vy, b.z - b.vz]) : null
  for (let pass = 0; pass < (rest ? 4 : 2); pass++)
    for (let i = 0; i < free.length; i++) {
      const a = free[i]
      for (let j = i + 1; j < free.length; j++) {
        const c = free[j]
        const dx = c.x - a.x
        const dy = c.y - a.y
        const dz = c.z - a.z
        if (dx > D || dx < -D || dy > D || dy < -D || dz > D || dz < -D) continue
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= D * D || d2 === 0) continue
        const d = Math.sqrt(d2)
        const nx = dx / d
        const ny = dy / d
        const nz = dz / d
        const push = (D - d) / 2
        a.x -= nx * push
        a.y -= ny * push
        a.z -= nz * push
        c.x += nx * push
        c.y += ny * push
        c.z += nz * push
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny + (c.vz - a.vz) * nz
        if (vn < 0 && pass === 0) {
          const k = vn * (0.5 + 0.38 * bounce)
          a.vx += k * nx
          a.vy += k * ny
          a.vz += k * nz
          c.vx -= k * nx
          c.vy -= k * ny
          c.vz -= k * nz
        }
      }
    }
  free.forEach(contain)
  // while resting, a ball's speed is how far it really moved, so pushes from the pile settle it
  if (before)
    free.forEach((b, i) => {
      b.vx = (b.x - before[i][0]) * 0.9
      b.vy = (b.y - before[i][1]) * 0.9
      b.vz = (b.z - before[i][2]) * 0.9
    })
}

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)

/** Where a picked ball is now and how big, or null once it has reached its slot. */
function pickPos(b: Ball, now: number) {
  const p = b.pick!
  const e = now - p.t0
  const top = pipe(p.slot)
  if (e < T_IN) {
    const s = ease(e / T_IN)
    return { x: p.sx + (CX - p.sx) * s, y: p.sy + (RISE_BOT - p.sy) * s, scale: DRAW_K - s * (DRAW_K - PIPE_K) }
  }
  if (e < T_IN + T_RISE) {
    const s = ease((e - T_IN) / T_RISE)
    return { x: CX + (top[0] - CX) * s, y: RISE_BOT + (PIPE_Y - RISE_BOT) * s, scale: PIPE_K }
  }
  const k = (e - T_IN - T_RISE) / T_PIPE
  if (k >= 1) return null
  const s = ease(k)
  const q = bez(top, s)
  // grows to tray size as it comes out of the pipe
  const g = Math.max(0, (s - 0.7) / 0.3)
  return { x: q.x, y: q.y, scale: PIPE_K + (TRAY_K - PIPE_K) * g }
}

/** A shade of hex colour `c`: amt > 0 lightens towards white, < 0 darkens towards black. */
function shade(c: string, amt: number) {
  const v = parseInt(c.slice(1), 16)
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(x =>
    Math.round(amt > 0 ? x + (255 - x) * amt : x * (1 + amt)),
  )
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

const sprites = new Map<string, HTMLCanvasElement>()

/**
 * One glossy 3D ball of radius `rp` device pixels with a white number face, drawn once per number
 * and size. `part` draws only the body, only the face (so it can turn) or only the shine.
 */
function sprite(n: number, rp: number, part: 'all' | 'body' | 'face' | 'gloss' = 'all') {
  const key = n + ':' + rp + part
  let s = sprites.get(key)
  if (s) return s
  s = document.createElement('canvas')
  const r = rp
  s.width = s.height = Math.ceil(r * 2 + 2)
  const c = s.getContext('2d')!
  const X = s.width / 2
  const col = colorOf(n)
  const has = (p: string) => part === 'all' || part === p
  if (has('body')) {
    // body: lit from the top left, deep shade at the bottom right
    const g = c.createRadialGradient(X - r * 0.38, X - r * 0.42, r * 0.05, X, X, r)
    g.addColorStop(0, shade(col, 0.55))
    g.addColorStop(0.35, col)
    g.addColorStop(0.85, shade(col, -0.45))
    g.addColorStop(1, shade(col, -0.7))
    c.fillStyle = g
    c.beginPath()
    c.arc(X, X, r, 0, 7)
    c.fill()
    // bounce light along the lower edge
    const bl = c.createRadialGradient(X + r * 0.2, X + r * 0.75, 0, X + r * 0.2, X + r * 0.75, r * 0.6)
    bl.addColorStop(0, shade(col, 0.3) + '')
    bl.addColorStop(1, 'rgba(0,0,0,0)')
    c.globalAlpha = 0.45
    c.fillStyle = bl
    c.fill()
    c.globalAlpha = 1
  }
  if (has('face')) {
    // white face with a soft edge
    const f = c.createRadialGradient(X - r * 0.12, X - r * 0.14, r * 0.1, X, X, r * 0.56)
    f.addColorStop(0, '#ffffff')
    f.addColorStop(0.8, '#f4f1fb')
    f.addColorStop(1, '#d9d2ea')
    c.fillStyle = f
    c.beginPath()
    c.arc(X, X, r * 0.55, 0, 7)
    c.fill()
    c.fillStyle = '#14102a'
    c.font = `800 ${Math.round(r * (n > 9 ? 0.56 : 0.66))}px Rubik, system-ui, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(n), X, X + r * 0.05)
  }
  if (has('gloss')) {
    // specular highlight
    const sp = c.createRadialGradient(X - r * 0.42, X - r * 0.5, 0, X - r * 0.42, X - r * 0.5, r * 0.42)
    sp.addColorStop(0, 'rgba(255,255,255,.95)')
    sp.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = sp
    c.beginPath()
    c.ellipse(X - r * 0.4, X - r * 0.5, r * 0.38, r * 0.24, -0.6, 0, 7)
    c.fill()
  }
  sprites.set(key, s)
  return s
}

const pipePath = (c: CanvasRenderingContext2D, i: number) => {
  const t = pipe(i)
  c.beginPath()
  c.moveTo(t[0], t[1])
  c.bezierCurveTo(t[2], t[3], t[4], t[5], t[6], t[7])
}

const pill = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  c.beginPath()
  c.roundRect(x, y, w, h, h / 2)
}

/** Glass, pipes, tray and pedestal: drawn once into a layer behind the balls and one in front. */
function layers(px: number) {
  const mk = () => {
    const cv = document.createElement('canvas')
    cv.width = (W + PAD * 2) * px
    cv.height = (H + PAD * 2) * px
    const c = cv.getContext('2d')!
    c.setTransform(px, 0, 0, px, PAD * px, PAD * px)
    return { cv, c }
  }
  const back = mk()
  let c = back.c

  // purple haze behind the machine
  // both glows fade out well inside the canvas, so no straight edge ever shows
  const halo = c.createRadialGradient(CX, CY, RY * 0.4, CX, CY, Math.min(CX, H - CY) - 4)
  halo.addColorStop(0, '#a855f740')
  halo.addColorStop(1, '#a855f700')
  c.fillStyle = halo
  c.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2)
  c.save()
  c.translate(CX, SLOT_Y)
  c.scale(1, 0.4)
  const th = c.createRadialGradient(0, 0, 20, 0, 0, Math.min(CX - 4, (SLOT_Y - 4) / 0.4))
  th.addColorStop(0, '#d946ef30')
  th.addColorStop(1, '#d946ef00')
  c.fillStyle = th
  c.fillRect(-CX, -SLOT_Y / 0.4, W, H / 0.4)
  c.restore()

  // the pedestal's lower platforms, behind the globe
  const ring = (y: number, rx: number, ry: number, depth: number, top: string, side: string, edge: string) => {
    const sg = c.createLinearGradient(CX - rx, 0, CX + rx, 0)
    sg.addColorStop(0, shade(side, -0.5))
    sg.addColorStop(0.35, shade(side, 0.25))
    sg.addColorStop(0.5, shade(side, 0.45))
    sg.addColorStop(0.65, side)
    sg.addColorStop(1, shade(side, -0.55))
    c.fillStyle = sg
    c.beginPath()
    c.ellipse(CX, y + depth, rx, ry, 0, 0, Math.PI)
    c.lineTo(CX - rx, y)
    c.ellipse(CX, y, rx, ry, 0, Math.PI, 0, true)
    c.closePath()
    c.fill()
    const tg = c.createRadialGradient(CX, y - ry * 0.3, 10, CX, y, rx)
    tg.addColorStop(0, shade(top, 0.15))
    tg.addColorStop(1, shade(top, -0.4))
    c.fillStyle = tg
    c.beginPath()
    c.ellipse(CX, y, rx, ry, 0, 0, 7)
    c.fill()
    c.save()
    c.shadowColor = edge
    c.shadowBlur = 14
    c.strokeStyle = edge
    c.lineWidth = 2
    c.beginPath()
    c.ellipse(CX, y + depth, rx, ry, 0, 0, Math.PI)
    c.stroke()
    c.beginPath()
    c.ellipse(CX, y, rx, ry, 0, 0, 7)
    c.stroke()
    c.restore()
  }
  ring(H - 42, 236, 26, 16, '#2a0f5e', '#5b21b6', '#e879f9')
  ring(H - 68, 186, 21, 14, '#3b1580', '#7c3aed', '#c084fc')

  // globe glass
  const gg = c.createRadialGradient(CX - 40, CY - 50, 10, CX, CY, RX)
  gg.addColorStop(0, '#6d28d955')
  gg.addColorStop(0.7, '#2e106577')
  gg.addColorStop(1, '#a855f766')
  c.fillStyle = gg
  c.beginPath()
  c.ellipse(CX, CY, RX, RY, 0, 0, 7)
  c.fill()
  // central riser glass
  const rg = c.createLinearGradient(CX - 21, 0, CX + 21, 0)
  rg.addColorStop(0, '#c4b5fd40')
  rg.addColorStop(0.5, '#ffffff14')
  rg.addColorStop(1, '#c4b5fd40')
  c.fillStyle = rg
  c.beginPath()
  c.roundRect(CX - 21, NECK_Y - 4, 42, RISE_BOT - NECK_Y + 22, [0, 0, 10, 10])
  c.fill()

  // pipe glass
  c.lineCap = 'butt'
  for (let k = 0; k < OUTLETS; k++) {
    pipePath(c, k)
    c.lineWidth = PIPE_W
    c.strokeStyle = '#7c3aed38'
    c.stroke()
  }

  // the tray capsule
  const trg = c.createLinearGradient(0, TRAY.y, 0, TRAY.y + TRAY.h)
  trg.addColorStop(0, '#3b1384')
  trg.addColorStop(0.5, '#1c0845')
  trg.addColorStop(1, '#2d0f69')
  c.fillStyle = trg
  pill(c, TRAY.x, TRAY.y, TRAY.w, TRAY.h)
  c.fill()
  // a coloured light and a dark socket under each slot
  SLOT_COLS.forEach((col, k) => {
    const x = slotX(k)
    const lg = c.createRadialGradient(x, SLOT_Y + 24, 2, x, SLOT_Y + 24, 42)
    lg.addColorStop(0, col)
    lg.addColorStop(0.45, col + '88')
    lg.addColorStop(1, col + '00')
    c.fillStyle = lg
    c.fillRect(x - 34, TRAY.y + 4, 68, TRAY.h - 6)
    c.fillStyle = '#0d0424cc'
    c.beginPath()
    c.arc(x, SLOT_Y, SLOT_R - 2, 0, 7)
    c.fill()
    c.strokeStyle = col + '99'
    c.lineWidth = 1.5
    c.stroke()
  })

  const front = mk()
  c = front.c
  // pipe walls: a neon outline (wide strokes with their middles cut out, so pipes merge at the neck)
  const tw = document.createElement('canvas')
  tw.width = (W + PAD * 2) * px
  tw.height = (H + PAD * 2) * px
  const t2 = tw.getContext('2d')!
  t2.setTransform(px, 0, 0, px, PAD * px, PAD * px)
  t2.lineCap = 'butt'
  for (let k = 0; k < OUTLETS; k++) {
    pipePath(t2, k)
    t2.lineWidth = PIPE_W + 6
    t2.strokeStyle = '#c084fc'
    t2.stroke()
  }
  t2.globalCompositeOperation = 'destination-out'
  for (let k = 0; k < OUTLETS; k++) {
    pipePath(t2, k)
    t2.lineWidth = PIPE_W
    t2.stroke()
  }
  t2.globalCompositeOperation = 'source-over'
  c.save()
  c.beginPath()
  c.rect(-PAD, TRAY.y + TRAY.h - 2, W + PAD * 2, H + PAD)
  c.clip()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.shadowColor = '#d946ef'
  c.shadowBlur = 10 * px
  c.drawImage(tw, 0, 0)
  c.restore()
  // glass shine down each pipe
  c.save()
  c.beginPath()
  c.rect(-PAD, TRAY.y + TRAY.h, W + PAD * 2, H + PAD)
  c.clip()
  for (let k = 0; k < OUTLETS; k++) {
    const t = pipe(k)
    const o = k < 3 ? 6 : -6
    c.beginPath()
    c.moveTo(t[0] - 7, t[1])
    c.bezierCurveTo(t[2] - 7, t[3], t[4] - 7 + o * 0, t[5], t[6] - 7, t[7])
    c.lineWidth = 2.5
    c.strokeStyle = '#ffffff38'
    c.stroke()
  }
  c.restore()

  // the riser's outline, faint so the balls behind still read
  c.strokeStyle = '#e9d5ff55'
  c.lineWidth = 1.5
  c.beginPath()
  c.roundRect(CX - 21, NECK_Y - 4, 42, RISE_BOT - NECK_Y + 22, [0, 0, 10, 10])
  c.stroke()
  c.strokeStyle = '#ffffff30'
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(CX - 13, NECK_Y + 6)
  c.lineTo(CX - 13, RISE_BOT + 8)
  c.stroke()

  // rim of the globe: thick violet glass, a bright inner line and reflections
  c.save()
  c.beginPath()
  c.ellipse(CX, CY, RX, RY, 0, 0, 7)
  c.lineWidth = 9
  c.strokeStyle = '#a855f766'
  c.shadowColor = '#d946ef'
  c.shadowBlur = 22
  c.stroke()
  c.restore()
  c.beginPath()
  c.ellipse(CX, CY, RX - 3, RY - 3, 0, 0, 7)
  c.lineWidth = 1.6
  c.strokeStyle = '#f5d0fe'
  c.stroke()
  c.save()
  c.beginPath()
  c.ellipse(CX, CY, RX - 4, RY - 4, 0, 0, 7)
  c.clip()
  const sh = c.createRadialGradient(CX - 80, CY - 80, 4, CX - 80, CY - 80, 90)
  sh.addColorStop(0, '#ffffff40')
  sh.addColorStop(1, '#ffffff00')
  c.fillStyle = sh
  c.fillRect(0, 0, W, H)
  c.lineCap = 'round'
  c.lineWidth = 8
  c.strokeStyle = '#ffffff2a'
  c.beginPath()
  c.ellipse(CX, CY, RX - 18, RY - 18, 0, Math.PI * 1.02, Math.PI * 1.38)
  c.stroke()
  c.lineWidth = 4
  c.strokeStyle = '#ffffff22'
  c.beginPath()
  c.ellipse(CX, CY, RX - 16, RY - 16, 0, Math.PI * 1.75, Math.PI * 1.92)
  c.stroke()
  c.restore()

  // neck collar where the pipes leave the globe
  const chrome = (x0: number, x1: number) => {
    const g = c.createLinearGradient(x0, 0, x1, 0)
    g.addColorStop(0, '#4c1d95')
    g.addColorStop(0.3, '#c4b5fd')
    g.addColorStop(0.5, '#f5f3ff')
    g.addColorStop(0.7, '#a78bfa')
    g.addColorStop(1, '#3b0f7a')
    return g
  }
  c.fillStyle = chrome(CX - 52, CX + 52)
  c.beginPath()
  c.roundRect(CX - 52, PIPE_Y - 4, 104, NECK_Y + 10 - PIPE_Y, 7)
  c.fill()
  c.strokeStyle = '#e879f9'
  c.lineWidth = 1.5
  c.stroke()
  c.fillStyle = '#ffffff66'
  c.fillRect(CX - 46, PIPE_Y - 1, 92, 2)

  // collar under the globe, then the name plate on the pedestal
  const cy = CY + RY - 8
  c.fillStyle = chrome(CX - 150, CX + 150)
  c.beginPath()
  c.ellipse(CX, cy + 10, 150, 16, 0, 0, Math.PI)
  c.lineTo(CX - 150, cy)
  c.ellipse(CX, cy, 150, 16, 0, Math.PI, 0, true)
  c.closePath()
  c.fill()
  c.save()
  c.shadowColor = '#d946ef'
  c.shadowBlur = 12
  c.strokeStyle = '#f0abfc'
  c.lineWidth = 2
  c.beginPath()
  c.ellipse(CX, cy + 10, 150, 16, 0, 0, Math.PI)
  c.stroke()
  c.restore()

  const py = H - 92
  c.save()
  c.shadowColor = '#d946ef'
  c.shadowBlur = 16
  c.fillStyle = '#1a0640'
  pill(c, CX - 90, py, 180, 42)
  c.fill()
  c.restore()
  c.strokeStyle = chrome(CX - 90, CX + 90)
  c.lineWidth = 3
  pill(c, CX - 90, py, 180, 42)
  c.stroke()
  c.font = '700 26px "Chakra Petch", Rubik, sans-serif'
  c.textBaseline = 'middle'
  const a = 'BINGO '
  const b = '90'
  const wa = c.measureText(a).width
  const wb = c.measureText(b).width
  const x0 = CX - (wa + wb) / 2
  c.textAlign = 'left'
  c.fillStyle = '#ffffff'
  c.fillText(a, x0, py + 22)
  c.fillStyle = '#ff4fd8'
  c.shadowColor = '#ff4fd8'
  c.shadowBlur = 10
  c.fillText(b, x0 + wa, py + 22)
  c.shadowBlur = 0

  // the tray's chrome rim and glass shine
  c.save()
  c.shadowColor = '#d946ef'
  c.shadowBlur = 18
  c.strokeStyle = '#c084fc'
  c.lineWidth = 3
  pill(c, TRAY.x, TRAY.y, TRAY.w, TRAY.h)
  c.stroke()
  c.restore()
  c.strokeStyle = chrome(TRAY.x, TRAY.x + TRAY.w)
  c.lineWidth = 2
  pill(c, TRAY.x + 6, TRAY.y + 6, TRAY.w - 12, TRAY.h - 12)
  c.stroke()
  const gl = c.createLinearGradient(0, TRAY.y + 6, 0, TRAY.y + 30)
  gl.addColorStop(0, '#ffffff38')
  gl.addColorStop(1, '#ffffff00')
  c.fillStyle = gl
  pill(c, TRAY.x + 22, TRAY.y + 8, TRAY.w - 44, 22)
  c.fill()
  return { back: back.cv, front: front.cv }
}

/** Starts the render and physics loop on canvas `cv`; returns a function that stops it. */
export function startGlobe(cv: HTMLCanvasElement, gs: GlobeState): () => void {
  const px = Math.min(LITE ? 1.5 : 2, window.devicePixelRatio || 1)
  cv.width = (W + PAD * 2) * px
  cv.height = (H + PAD * 2) * px
  const c = cv.getContext('2d')!
  const art = layers(px)
  const small = Math.round(BR * (1 + DEPTH_K) * px)
  const big = Math.round((SLOT_R - 1) * px)
  let raf = 0
  let last = performance.now()
  let acc = 0
  let lastDraw = 0
  const minGap = LITE ? 1000 / 31 : 0

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    acc += Math.min(100, now - last)
    last = now
    while (acc >= STEP) {
      step(gs, now)
      acc -= STEP
    }
    if (now - lastDraw < minGap) return
    lastDraw = now
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, cv.width, cv.height)
    c.drawImage(art.back, 0, 0)
    c.setTransform(px, 0, 0, px, PAD * px, PAD * px)
    const done: Ball[] = []
    const moving: { b: Ball; x: number; y: number; k: number }[] = []
    const inside: Ball[] = []
    for (const b of gs.balls) {
      if (!b.pick) {
        inside.push(b)
        continue
      }
      const p = pickPos(b, now)
      if (p) moving.push({ b, x: p.x, y: p.y, k: p.scale })
      else done.push(b)
    }
    // back to front: nearer balls are bigger and drawn over the ones behind them
    inside.sort((a, b) => a.z - b.z)
    const full = small / px / (BR * (1 + DEPTH_K))
    for (const b of inside) {
      const depth = b.z / RZ
      const r = BR * (1 + DEPTH_K * depth) * full
      c.drawImage(sprite(b.n, small, 'body'), b.x - r, b.y - r, r * 2, r * 2)
      c.save()
      c.translate(b.x, b.y)
      c.rotate(b.a)
      c.drawImage(sprite(b.n, small, 'face'), -r, -r, r * 2, r * 2)
      c.restore()
      c.drawImage(sprite(0, small, 'gloss'), b.x - r, b.y - r, r * 2, r * 2)
      // balls at the back sit in the shade of the glass
      if (depth < 0) {
        c.globalAlpha = -depth * 0.45
        c.fillStyle = '#140733'
        c.beginPath()
        c.arc(b.x, b.y, r * 0.98, 0, 7)
        c.fill()
        c.globalAlpha = 1
      }
    }
    done.forEach(b => {
      gs.balls.splice(gs.balls.indexOf(b), 1)
      b.pick!.cb()
    })
    gs.slots.forEach((n, k) => {
      if (!n) return
      const s = sprite(n, big)
      const r = s.width / px / 2
      c.drawImage(s, slotX(k) - r, SLOT_Y - r, r * 2, r * 2)
    })
    for (const m of moving) {
      const s = sprite(m.b.n, big)
      const r = BR * m.k * (s.width / 2 / big)
      // the pipe runs behind the tray: the ball shows below it, and rises into view through its hole
      c.save()
      c.beginPath()
      c.rect(-PAD, TRAY.y + TRAY.h - 1, W + PAD * 2, H + PAD)
      c.arc(slotX(m.b.pick!.slot), SLOT_Y, SLOT_R - 2, 0, Math.PI * 2)
      c.clip()
      c.drawImage(s, m.x - r, m.y - r, r * 2, r * 2)
      c.restore()
    }
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.drawImage(art.front, 0, 0)
    // running lights along the front edge of the base
    c.setTransform(px, 0, 0, px, PAD * px, PAD * px)
    const lit = Math.floor(now / (gs.busy ? 90 : 320))
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * (0.08 + (0.84 * i) / 17)
      const x = CX + Math.cos(a) * 236
      const y = H - 26 + Math.sin(a) * 26
      c.fillStyle = (i + lit) % 4 === 0 ? (i % 2 ? '#f472b6' : '#22d3ee') : '#ffffff30'
      c.beginPath()
      c.arc(x, y, 2.4, 0, 7)
      c.fill()
    }
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
