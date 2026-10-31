import { SFX } from '../audio/sfx'
import { GlobeState } from '../engine/globe'
import {
  BALLS,
  BOT_NAMES,
  MAX_CALLS,
  BUY_SECS,
  CALLS,
  CHAT_LINES,
  CHATTERS,
  END_SECS,
  LITE,
  PRICES,
  QUICK,
  PRIZES,
  prizeAt,
  START_POINTS,
  STRIP,
  MAX_CARDS,
  fmt,
  kes,
  rnd,
} from './constants'
import { levelOf, makeStrip, numsOf, toGo, type Grid, type Ticket } from './tickets'

export type Phase = 'buy' | 'draw' | 'end'

export interface ChatMsg {
  id: number
  who: string
  msg: string
}
export interface WinRow {
  id: number
  who: string
  label: string
  pay: number
  balls: number
  round: number
}
export interface Toast {
  id: number
  txt: string
  cls: string
}
export interface Prefs {
  sfx: boolean
  music: boolean
  voice: boolean
  guide: boolean
}
/** The saved balance, or the starting one. */
function loadPts() {
  try {
    const v = Number(localStorage.getItem('b90pts'))
    if (v > 0 && Number.isFinite(v)) return v
  } catch {
    // no storage
  }
  return START_POINTS
}

export type PrefKey = keyof Prefs
export interface Claim {
  who: string
  pay: number
  balls: number
}
export interface HostLine {
  key: number
  text: string
}
export interface ConfettiPiece {
  left: string
  dx: string
  dy: string
  rot: string
  bg: string
  delay: string
  dur: string
  round: boolean
}

/** What the win popup shows when one of the player's tickets takes a prize. */
export interface WinView {
  key: number
  title: string
  prize: string
  pay: number
  ticket: Ticket
  balls: number
  jackpot: boolean
  confetti: ConfettiPiece[]
}

interface Bot {
  name: string
  ts: Grid[]
  /** prize level reached this round */
  lv?: number
}

/** ms the blower runs before the first ball */
const SPIN_UP = 900
/** ms between one ball leaving for its pipe and the next one following it up */
const CALL_GAP = 450
/** ms before the round ends after the Full House goes to another player */
const PRIZE_PAUSE = 1600
/** ms the player's win popup stays up (the draw carries on behind it) */
const WIN_PAUSE = 2600

function loadPrefs(): Prefs {
  let raw: Partial<Prefs> = {}
  try {
    raw = JSON.parse(localStorage.getItem('b90prefs') || '{}')
  } catch {
    raw = {}
  }
  return { sfx: raw.sfx !== false, music: raw.music !== false, voice: raw.voice !== false, guide: raw.guide !== false }
}

/**
 * All game state and rules. React components subscribe through `useGame` and re-render on every
 * `emit`; the tower canvas reads `tower` directly every frame.
 */
export class Game {
  /** the balance, kept on this device so a win is still there after a reload */
  pts = loadPts()
  private savedPts = this.pts
  /** the last amount paid in, for the "+KES" that floats up from the balance */
  gain: { key: number; amt: number } | null = null
  phase: Phase = 'buy'
  secs = BUY_SECS
  timerText = fmt(BUY_SECS)
  phaseLabel = 'Buy your cards'
  round = 0
  called: number[] = []
  /** the ball that just came out, shown big with its call */
  last: number | null = null
  /** the prize being played for: index into PRIZES, past the end = round over */
  stage = 0
  claims: (Claim | null)[] = [null, null, null]
  tickets: Ticket[] = []
  /** tickets bought during a draw, waiting for the next round */
  queued: Ticket[] = []
  /** the buying panel: price per ticket and how many tickets */
  buy = { price: PRICES[1], count: 3 }
  /** the card picker: a fresh strip to browse, the card in front and the ones taken so far */
  picker: { cards: Grid[]; prices: number[]; at: number; taken: number[]; quick: number } | null = null
  fresh: number | null = null
  roundWin = 0
  /** per card, the highest prize level it has been paid for this round */
  paid = new Map<number, number>()
  winners: WinRow[] = []
  chatLog: ChatMsg[] = []
  toasts: Toast[] = []
  host: HostLine | null = null
  win: WinView | null = null
  prefs: Prefs = loadPrefs()
  shakeKey = 0
  /** which page of four tickets is on screen */
  page = 0
  /** the full winners list is open */
  allWinners = false
  /** the chat is expanded (phones keep it folded into a bar) */
  chatOpen = false

  readonly tower = new GlobeState()

  private bots: Bot[] = []
  private timer: number | undefined
  private winTimer: number | undefined
  /** balls sent up this round, landed or still in a pipe */
  private picked = new Set<number>()
  private uid = 0
  private started = false
  private version = 0
  private listeners = new Set<() => void>()
  private nearSaid = new Set<string>()

  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getVersion = () => this.version
  emit() {
    this.version++
    if (this.pts !== this.savedPts) {
      this.savedPts = this.pts
      try {
        localStorage.setItem('b90pts', String(this.pts))
      } catch {
        // private mode: the balance just won't survive a reload
      }
    }
    this.listeners.forEach(l => l())
  }

  get calledSet() {
    return new Set(this.called)
  }
  /** Tickets bought now play in this round while it is buying, otherwise in the next one. */
  get forNext() {
    return this.phase !== 'buy'
  }
  get canBuy() {
    const have = this.forNext ? this.queued.length : this.tickets.length
    return have === 0 && PRICES[0] <= this.pts
  }
  get players() {
    return this.bots.length + (this.tickets.length ? 1 : 0)
  }
  get ticketsInPlay() {
    return this.bots.reduce((a, b) => a + b.ts.length, 0) + this.tickets.length
  }
  /** The prize pot of the round on screen, from the prices paid for one ticket. */
  get prizeValues() {
    const p = this.tickets[0]?.price ?? this.buy.price
    return PRIZES.map(z => p * z.x)
  }
  /** The player's tickets, closest to the current prize first, with how many numbers each needs. */
  get sorted() {
    const set = this.calledSet
    return this.tickets
      .map((t, i) => ({ t, i, tg: this.nextOf(t) > PRIZES.length ? 0 : toGo(t.rows, set, this.nextOf(t)) }))
      .sort((a, b) => (this.phase === 'buy' ? a.i - b.i : a.tg - b.tg || a.i - b.i))
  }

  /** the prize level card `t` is playing for next (past the last prize when it has won them all) */
  nextOf(t: Ticket) {
    return (this.paid.get(t.id) ?? 0) + 1
  }

  start() {
    if (this.started) return
    this.started = true
    SFX.bindDrawing(() => this.phase === 'draw')
    SFX.set('sfx', this.prefs.sfx)
    SFX.set('music', this.prefs.music)
    this.say('NeonNina', 'Lights are on, let’s go!')
    this.say('LuckyStar', 'Good luck everyone!')
    this.startRound()
    setInterval(() => {
      if (Math.random() < 0.5) this.say(CHATTERS[rnd(4)], CHAT_LINES[rnd(CHAT_LINES.length)])
    }, 4500)
  }

  say(who: string, msg: string) {
    this.chatLog.push({ id: ++this.uid, who, msg })
    if (this.chatLog.length > 40) this.chatLog = this.chatLog.slice(-40)
    this.emit()
  }

  // ---- rounds ----
  private tick = () => {
    this.secs--
    this.timerText = fmt(Math.max(this.secs, 0))
    if (this.phase === 'buy' && this.secs > 0 && this.secs <= 5) SFX.tick(this.secs)
    if (this.secs <= 0) {
      clearInterval(this.timer)
      this.startDraw()
    } else this.emit()
  }

  startRound() {
    this.phase = 'buy'
    this.phaseLabel = 'Buy your cards'
    this.round++
    this.called = []
    this.last = null
    this.stage = 0
    this.claims = [null, null, null]
    this.roundWin = 0
    this.paid = new Map()
    this.nearSaid.clear()
    this.tickets = this.queued
    this.queued = []
    this.page = 0
    if (this.tickets.length) {
      const k = this.tickets.length
      this.note(`Your ${k} saved card${k > 1 ? 's are' : ' is'} in this round. Good luck!`)
    }
    this.tower.reset()
    this.bots = Array.from({ length: 23 }, (_, i) => {
      const s = makeStrip()
      return { name: BOT_NAMES[i % 12] + (i >= 12 ? i : ''), ts: s.slice(0, 1 + rnd(MAX_CARDS)) }
    })
    this.secs = BUY_SECS
    this.timerText = fmt(this.secs)
    clearInterval(this.timer)
    this.timer = window.setInterval(this.tick, 1000)
    this.emit()
  }

  private startDraw() {
    this.phase = 'draw'
    this.phaseLabel = 'Live draw'
    this.timerText = 'LIVE'
    this.emit()
    const lead = SFX.go()
    this.say('Host', `Eyes down! ${MAX_CALLS} balls, playing for ${PRIZES[0].label.toLowerCase()}.`)
    this.tower.busy = true
    this.picked.clear()
    SFX.whirl(SPIN_UP / 1000 + lead)
    setTimeout(() => this.nextBall(), lead * 1000 + SPIN_UP)
  }

  /** Sends the next ball up; balls follow each other through the pipes without waiting to land. */
  private nextBall() {
    if (this.phase !== 'draw' || this.stage > 2 || this.picked.size >= MAX_CALLS) return
    let n = 1 + rnd(BALLS)
    while (this.picked.has(n)) n = 1 + rnd(BALLS)
    this.picked.add(n)
    const round = this.round
    SFX.slide(2)
    this.tower.pick(n, () => this.land(n, round))
    setTimeout(() => this.nextBall(), CALL_GAP)
  }

  /** A ball has reached its slot on top: call it, mark tickets and check for a prize. */
  private land(n: number, round: number) {
    // balls still in a pipe when the round ends do not count
    if (this.phase !== 'draw' || round !== this.round || this.stage > 2) return
    {
      this.called.push(n)
      this.last = n
      this.fresh = n
      const mine = this.tickets.some(t => t.nums.includes(n))
      SFX.ding(this.called.length % 7)
      if (mine) SFX.hit()
      this.checkPrize()
      this.nearCheck(mine)
      this.emit()
      if (this.called.length >= MAX_CALLS) {
        this.say('Host', `All ${MAX_CALLS} balls drawn. Round over!`)
        this.stage = 3
        this.tower.busy = false
        setTimeout(() => this.endRound(), this.win ? WIN_PAUSE : 900)
      }
    }
  }

  /** Pays each of the player's cards for every prize it has newly reached, and has the room's players call their wins. */
  private checkPrize() {
    const set = this.calledSet
    const balls = this.called.length
    let pay = 0
    let top = 0
    let best: Ticket | null = null
    for (const t of this.tickets) {
      const was = this.paid.get(t.id) ?? 0
      const now = Math.min(PRIZES.length, levelOf(t.rows, set))
      if (now <= was) continue
      // each level pays the difference, so a card ends up with its top prize's multiplier
      pay += prizeAt(t.price, now) - prizeAt(t.price, was)
      this.paid.set(t.id, now)
      if (now > top || (now === top && best && t.price > best.price)) {
        top = now
        best = t
      }
    }
    if (best) {
      const z = PRIZES[top - 1]
      pay = Math.round(pay * 100) / 100
      this.pts = Math.round((this.pts + pay) * 100) / 100
      this.roundWin += pay
      this.gain = { key: ++this.uid, amt: pay }
      this.winners.unshift({ id: ++this.uid, who: 'You', label: z.label, pay, balls, round: this.round })
      this.showWin(best, z.label, pay, top)
    }
    // the room's players win too, now and then, and say so in the chat
    for (const b of this.bots) {
      const lv = Math.min(PRIZES.length, Math.max(0, ...b.ts.map(g => levelOf(g, set))))
      if (lv > (b.lv ?? 0)) {
        b.lv = lv
        if (Math.random() < 0.35) this.say(b.name, PRIZES[lv - 1].label + (lv >= 3 ? '! 🎉' : '!'))
      }
    }
    if (this.winners.length > 20) this.winners.length = 20
  }

  /** Toasts when the player's best ticket is one or two numbers away. */
  private nearCheck(mine: boolean) {
    if (!this.tickets.length) return
    const set = this.calledSet
    const open = this.tickets.filter(t => this.nextOf(t) <= PRIZES.length)
    if (mine) this.shakeKey++
    if (!open.length) return
    const best = Math.min(...open.map(t => toGo(t.rows, set, this.nextOf(t))))
    const lv = Math.min(...open.map(t => this.nextOf(t)))
    const key = lv + ':' + best
    if (best <= 2 && !this.nearSaid.has(key)) {
      this.nearSaid.add(key)
      this.toast(best === 1 ? '1 TO GO!' : '2 TO GO', 'near')
      if (best === 1) SFX.near()
    }
  }

  private endRound() {
    this.phase = 'end'
    this.phaseLabel = 'Round over'
    this.tower.busy = false
    this.stage = 3
    SFX.end()
    if (this.tickets.length && this.roundWin === 0) setTimeout(() => SFX.aww(), 700)
    this.emit()
    let s = END_SECS
    this.timerText = fmt(s)
    this.timer = window.setInterval(() => {
      if (this.win) return
      s--
      this.timerText = fmt(Math.max(s, 0))
      if (s <= 0) {
        clearInterval(this.timer)
        this.startRound()
      } else this.emit()
    }, 1000)
  }

  private showWin(t: Ticket, prize: string, pay: number, level: number) {
    const jackpot = false
    const set = this.calledSet
    const cols = ['#22d3ee', '#f472b6', '#facc15', '#a78bfa', '#34d399', '#fb923c']
    const confetti: ConfettiPiece[] = []
    for (let side = 0; side < 2; side++)
      for (let i = 0; i < (LITE ? 14 : 34); i++) {
        const dir = side ? -1 : 1
        const sp = 0.4 + Math.random() * 0.8
        confetti.push({
          left: side ? '94%' : '6%',
          dx: dir * (40 + Math.random() * 34) * sp + 'vw',
          dy: -(45 + Math.random() * 50) + 'vh',
          rot: Math.random() * 900 - 450 + 'deg',
          bg: cols[i % cols.length],
          round: i % 3 === 0,
          delay: 0.1 + Math.random() * 0.5 + 's',
          dur: 2.4 + Math.random() * 1.4 + 's',
        })
      }
    this.win = {
      key: ++this.uid,
      title: PRIZES[level - 1].label.toUpperCase() + '!',
      prize,
      pay,
      ticket: t,
      balls: this.called.length,
      jackpot,
      confetti,
    }
    // a single line pays back less than the card, so it gets a chime; bigger wins get the show
    if (level < 2) SFX.star(1)
    else {
      SFX.bingo()
      setTimeout(() => SFX.cheer(level >= 4), 650)
    }
    clearTimeout(this.winTimer)
    this.winTimer = window.setTimeout(() => this.hideWin(), WIN_PAUSE - 200)
  }

  hideWin() {
    if (!this.win) return
    this.win = null
    this.emit()
  }

  private toast(txt: string, cls: string) {
    const id = ++this.uid
    this.toasts = [...this.toasts.slice(-2), { id, txt, cls }]
    this.emit()
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id)
      this.emit()
    }, 1700)
  }

  private note(text: string) {
    const key = ++this.uid
    this.host = { key, text }
    this.emit()
    setTimeout(() => {
      if (this.host?.key !== key) return
      this.host = null
      this.emit()
    }, 6000)
  }

  hideHost() {
    this.host = null
    this.emit()
  }

  // ---- view ----
  setPage(p: number) {
    const pages = Math.max(1, Math.ceil(this.tickets.length / 4))
    this.page = (p + pages) % pages
    SFX.swipe()
    this.emit()
  }

  toggleWinners() {
    this.allWinners = !this.allWinners
    this.emit()
  }

  toggleChat() {
    this.chatOpen = !this.chatOpen
    this.emit()
  }

  /** Demo balance top-up. */
  topUp() {
    this.pts += 500
    SFX.coin()
    this.toast('+KES 500 DEMO CREDIT', 'claim')
  }

  /** The speaker button: game sounds and music together. */
  get soundOn() {
    return this.prefs.sfx || this.prefs.music
  }
  toggleSound() {
    const v = !this.soundOn
    this.setPref('sfx', v)
    this.setPref('music', v)
  }

  // ---- buying ----
  /** Quick pick: four cards at one stake, shown in the picker ready to buy. */
  quickPick(price: number) {
    if (!this.canBuy) return
    const n = Math.min(QUICK, Math.floor(this.pts / price))
    if (!n) {
      this.note(`Not enough balance for a ${kes(price)} card. Tap + to top up.`)
      SFX.aww()
      return
    }
    this.picker = { cards: makeStrip(), prices: Array(STRIP).fill(price), at: 0, taken: Array.from({ length: n }, (_, i) => i), quick: price }
    SFX.coin()
    SFX.deal()
    this.emit()
  }

  /** Pick your own: six cards, each at its own price; a dearer card pays bigger prizes. */
  openPicker() {
    if (!this.canBuy) return
    const prices = [...PRICES, PRICES[1], PRICES[2]].sort(() => Math.random() - 0.5)
    this.picker = { cards: makeStrip(), prices, at: 0, taken: [], quick: 0 }
    SFX.deal()
    this.emit()
  }

  closePicker() {
    this.picker = null
    SFX.swipe()
    this.emit()
  }

  /** Brings card `i` of the picker to the front. */
  pickerShow(i: number) {
    const p = this.picker
    if (!p) return
    const n = p.cards.length
    this.picker = { ...p, at: (i + n) % n }
    SFX.swipe()
    this.emit()
  }

  /** What the cards taken in the picker cost together. */
  get pickerTotal() {
    const p = this.picker
    return p ? p.taken.reduce((a, i) => a + p.prices[i], 0) : 0
  }

  /** Takes the card in front, or puts it back if it is already taken. */
  pickerTake() {
    const p = this.picker
    if (!p) return
    const has = p.taken.includes(p.at)
    if (!has && (p.taken.length >= MAX_CARDS || this.pickerTotal + p.prices[p.at] > this.pts)) {
      SFX.aww()
      return
    }
    this.picker = { ...p, taken: has ? p.taken.filter(i => i !== p.at) : [...p.taken, p.at] }
    if (has) SFX.swipe()
    else SFX.pop()
    // after taking one, show the next card that is still free
    const q = this.picker
    if (!has && q.taken.length < q.cards.length) {
      let i = q.at
      do i = (i + 1) % q.cards.length
      while (q.taken.includes(i))
      this.picker = { ...q, at: i }
    }
    this.emit()
  }

  /** Buys the cards taken in the picker, each at its own price. */
  pickerBuy() {
    const p = this.picker
    if (!p || !p.taken.length || this.pickerTotal > this.pts) return
    this.picker = null
    this.buyTickets(
      p.taken.map(i => p.cards[i]),
      p.taken.map(i => p.prices[i]),
    )
  }

  /** Buys the given cards at the given prices. */
  private buyTickets(grids: Grid[], prices: number[]) {
    const count = grids.length
    const total = prices.reduce((a, b) => a + b, 0)
    if (!this.canBuy || total > this.pts) return
    // the dearest card sets the prizes shown while playing
    this.buy = { price: Math.max(...prices), count }
    const ts = grids.map((rows, i) => ({ id: ++this.uid, rows, nums: numsOf(rows), price: prices[i] }))
    this.pts -= total
    SFX.coin()
    SFX.deal()
    const s = count > 1 ? 's' : ''
    if (this.forNext) {
      this.queued = ts
      this.note(`${count} card${s} saved. ${count > 1 ? 'They play' : 'It plays'} when the next round starts.`)
      this.say('Host', `You bought ${count} card${s} for the next round`)
    } else {
      this.tickets = ts
      this.page = 0
      this.say('Host', `You bought ${count} card${s} for ${kes(total)}`)
    }
    this.emit()
  }

  /** Swaps the player's tickets for new numbers before the draw. Free. */
  reshuffle() {
    if (this.phase !== 'buy' || !this.tickets.length) return
    const s = makeStrip()
    this.tickets = this.tickets.map((t, i) => ({ ...t, id: ++this.uid, rows: s[i], nums: numsOf(s[i]) }))
    SFX.deal()
    this.emit()
  }

  /** Hands the tickets back for a refund before the draw. */
  refund() {
    const list = this.forNext ? this.queued : this.tickets
    if (!list.length) return
    this.pts += list.reduce((a, t) => a + t.price, 0)
    if (this.forNext) this.queued = []
    else this.tickets = []
    SFX.swipe()
    this.emit()
  }

  setPref(k: PrefKey, v: boolean) {
    this.prefs = { ...this.prefs, [k]: v }
    if (k === 'sfx' || k === 'music') SFX.set(k, v)
    SFX.pop()
    try {
      localStorage.setItem('b90prefs', JSON.stringify(this.prefs))
    } catch {
      /* storage unavailable */
    }
    this.emit()
  }
}

export const game = new Game()
