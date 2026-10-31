/**
 * Phones and small or low-memory devices get a lighter show: fewer particles and a 30 fps machine.
 */
export const LITE =
  typeof window !== 'undefined' &&
  (matchMedia('(max-width:899px)').matches ||
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4 ||
    (navigator.hardwareConcurrency || 8) <= 4)

/** Balls in the machine, 1 to 90. */
export const BALLS = 90
/** Balls drawn per round. Every card is paid for each prize it reaches within these balls. */
export const MAX_CALLS = 56
/** Tickets in a strip: a full strip holds every number once. */
export const STRIP = 6
/** how many cards a stake chip's quick pick holds */
export const MAX_CARDS = 4
export const QUICK = MAX_CARDS
/** Ticket prices, in KES. */
export const PRICES = [10, 20, 50, 100]
export const BUY_SECS = 20
/** Pause after the full house before the next round's buying starts. */
export const END_SECS = 4
export const START_POINTS = 2450

export interface Prize {
  /** 1 for the first prize, 2 for the second */
  level: number
  /** complete lines (rows, columns or diagonals) the card needs */
  lines: number
  label: string
  /** pays card price × x */
  x: number
}

/**
 * Each card is paid the multiplier of the highest prize it reaches (not the sum), whatever
 * other cards do. This is a standard bingo ladder: about 85% of stakes go back to players
 * and the house keeps about 15%. Small wins are frequent and the top prizes are rare.
 * Simulated with 200,000 cards on 56-ball draws: about 70% of cards reach at least
 * 1 line, 36% reach 2, 14% reach 3, 5% reach 4 and 1.5% reach 5.
 */
export const PRIZES: Prize[] = [
  { level: 1, lines: 1, label: '1 Line', x: 0.4 },
  { level: 2, lines: 2, label: '2 Lines', x: 1 },
  { level: 3, lines: 3, label: '3 Lines', x: 2 },
  { level: 4, lines: 4, label: '4 Lines', x: 5 },
  { level: 5, lines: 5, label: '5 Lines', x: 10 },
]

/** what a card of price `p` has won in total at prize level `lv` (0 = nothing) */
export const prizeAt = (p: number, lv: number) => (lv ? Math.round(p * PRIZES[lv - 1].x * 100) / 100 : 0)

/** One colour per card column: B 1–18, I 19–36, N 37–54, G 55–72, O 73–90. */
export const COL_COLORS = ['#3b82f6', '#ef4444', '#a855f7', '#22c55e', '#f59e0b']
export const colOf = (n: number) => Math.min(4, Math.floor((n - 1) / (BALLS / 5)))
export const colorOf = (n: number) => COL_COLORS[colOf(n)]

/** The caller's rhymes for some numbers, said with the number. */
export const CALLS: Record<number, string> = {
  1: "Kelly's eye", 2: 'One little duck', 3: 'Cup of tea', 7: 'Lucky seven', 8: 'Garden gate', 10: 'Big fat hen',
  11: 'Legs eleven', 13: 'Unlucky for some', 16: 'Sweet sixteen', 21: 'Key of the door', 22: 'Two little ducks',
  26: 'Pick and mix', 30: 'Dirty Gertie', 44: 'Droopy drawers', 45: 'Halfway there', 50: "Half a century",
  55: 'Snakes alive', 66: 'Clickety click', 77: 'Sunset strip', 85: 'Staying alive', 88: 'Two fat ladies', 90: 'Top of the shop',
}

export const BOT_NAMES = ['NeonNina', 'LuckyStar', 'BingoPro', 'TopPlayer', 'Player_4D2F', 'Mia', 'Kofi', 'Zed', 'Anya', 'Leo', 'Tariq', 'Nova']
export const CHAT_LINES = ['Good luck everyone!', 'Full strip this time 💪', 'Come on 41!', 'Just joined the room', 'One to go on the house!', 'So close!', 'Two little ducks please', 'Love this tower']
export const CHATTERS = ['NeonNina', 'LuckyStar', 'BingoPro', 'TopPlayer']

export const fmt = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
export const rnd = (n: number) => Math.floor(Math.random() * n)
export const kes = (n: number) => {
  const c = Math.round(n * 100) / 100
  const d = c % 1 ? 2 : 0
  return 'KES ' + c.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
