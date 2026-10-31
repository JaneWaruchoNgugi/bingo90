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
/** Balls called per round: if nobody has the full house by then, the round ends without it. */
export const MAX_CALLS = 63
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
  /** rows a ticket needs complete */
  rows: number
  label: string
  /** pays ticket price × x */
  x: number
}

/** The three prizes, played in order: the round ends when the full house goes. */
export const PRIZES: Prize[] = [
  { rows: 1, label: 'One Line', x: 2 },
  { rows: 2, label: 'Two Lines', x: 5 },
  { rows: 3, label: 'Full House', x: 15 },
]
/** A full house inside this many balls wins the jackpot instead. */
export const JACKPOT_BALLS = 50
export const JACKPOT_X = 100

/** One neon colour per ticket column (1–9, 10–19, … 80–90). */
export const COL_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#fb923c', '#60a5fa', '#e879f9', '#f87171']
export const colOf = (n: number) => Math.min(8, Math.floor(n / 10))
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
export const kes = (n: number) => 'KES ' + n.toLocaleString('en-US')
