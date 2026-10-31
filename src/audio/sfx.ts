/**
 * Every sound in Bingo 90, styled after a TV lottery draw show: a pulsing studio groove in
 * E minor (four-on-the-floor kick, pumping synth bass, plucked synth hook, a driving arpeggio
 * and risers while the balls are drawn), the air blower roaring with balls clattering in the
 * globe, a pneumatic suck as each ball is taken, a bright "ta-ding" as it is revealed, an
 * electronic countdown, a drumroll and synth stab to start the draw, a slot-machine jackpot
 * with sirens and bells for wins, a cash register for buying, and a studio crowd.
 * Clips in ./samples are used where they exist; every other sound is synthesized live.
 * The context starts on the first user gesture.
 */
type Bus = 'sfx' | 'music' | 'pad' | 'crowd'
interface Opts {
  vol?: number
  a?: number
  /** hold the level until the end instead of decaying */
  sus?: boolean
  type?: OscillatorType
  to?: number
  gl?: number
  vib?: number
  det?: number
  lp?: number
  hp?: number
  q?: number
  send?: number
  pan?: number
  bus?: Bus
}
interface NoiseOpts extends Opts {
  ft?: BiquadFilterType
  f0?: number
  f1?: number
}
interface ClipOpts {
  vol?: number
  pan?: number
  rate?: number
  /** fit the clip to this many seconds (fades out at the end) */
  dur?: number
  bus?: Bus
}

/**
 * Recordings by file name without extension. `name-1`, `name-2`… are takes of one sound and
 * one is picked at random each time. Each clip ships as .ogg and .m4a; the browser gets the one
 * it can play.
 */
const CLIPS = import.meta.glob('./samples/*.{mp3,ogg,wav,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
/** Clip levels, so each recording sits where its synthesized version did. */
const CLIP_VOL: Record<string, number> = {
  music: 0.08,
  coin: 0.26,
  card: 1.8,
  swipe: 0.51,
  fan: 0.9,
  deal: 1,
  tick: 0.82,
  near: 0.2,
  jackpot: 0.68,
  star: 0.3,
  end: 0.18,
  cheer: 1,
  'cheer-small': 0.72,
  applause: 0.8,
}
/** the file to load for each clip name, in the format this browser plays best */
function clipFiles() {
  const a = typeof Audio !== 'undefined' ? new Audio() : undefined
  const ok = (t: string) => !!a && a.canPlayType(t) !== ''
  const order = [ok('audio/ogg; codecs="vorbis"') && 'ogg', ok('audio/mp4; codecs="mp4a.40.2"') && 'm4a', 'mp3', 'wav', 'ogg', 'm4a']
  const by: Record<string, Record<string, string>> = {}
  for (const [path, url] of Object.entries(CLIPS)) {
    const m = path.match(/([^/]+)\.(\w+)$/)!
    ;(by[m[1]] ??= {})[m[2]] = url
  }
  return Object.entries(by).map(([name, f]) => {
    const urls = [...new Set(order.filter(Boolean) as string[])].filter(x => f[x]).map(x => f[x])
    return { name, urls }
  })
}

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
/** Em – C – G – D: the classic draw-show loop, voiced close for a bright pad */
const PROG = [
  [52, 55, 59, 64],
  [52, 55, 60, 64],
  [50, 55, 59, 62],
  [50, 54, 57, 62],
]
const ROOT = [40, 36, 43, 38]
/** the plucked synth hook, one note per 8th (0 = rest); the second time round it answers itself */
const HOOK = [
  [
    [76, 0, 79, 0, 83, 0, 81, 79],
    [76, 0, 0, 72, 76, 0, 79, 0],
    [74, 0, 79, 0, 83, 0, 86, 83],
    [81, 0, 78, 0, 74, 0, 0, 0],
  ],
  [
    [83, 0, 81, 79, 0, 76, 79, 0],
    [84, 0, 83, 0, 79, 0, 76, 0],
    [79, 0, 83, 0, 86, 0, 83, 79],
    [78, 0, 81, 0, 78, 0, 74, 0],
  ],
]
/** arpeggio order over the chord tones while numbers are drawn, one note per 16th */
const ARP = [0, 2, 1, 3, 2, 1, 3, 2]
const BPM = 124
/** music level, and where it returns to after being ducked */
const MUSIC = 3.2
/**
 * Per-sound level trims in dB, measured by playing each sound through the master bus,
 * so the sounds sit above the music and small UI sounds stay subtle but audible.
 */
const TRIM: Record<string, number> = { tick: 6.5, pop: 4, swipe: -3, go: 4.5, end: 2, aww: -3, cheer: 15, bingo: 2.5 }
const db = (x: number) => 10 ** (x / 20)
const S16 = 60 / BPM / 4

/** pitch steps of the seven reveal dings, E minor pentatonic up the tray: E – G – A – B – D – E – G */
const POP_STEPS = [0, 3, 5, 7, 10, 12, 15].map(x => 2 ** (x / 12))

type Kit = Record<'whirl' | 'tok' | 'swish' | 'pop' | 'land' | 'chime', AudioBuffer>

/**
 * The ball sounds, written straight into small buffers once when sound starts. Playing one is a
 * single buffer and a gain, so a fast draw never keeps the phone busy.
 */
function makeKit(c: BaseAudioContext): Kit {
  const sr = c.sampleRate
  const mk = (dur: number, f: (t: number) => number) => {
    const b = c.createBuffer(1, Math.ceil(dur * sr), sr)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = f(i / sr)
    return b
  }
  const TAU = Math.PI * 2
  /** a sine sweeping from f0 to f1 over `glide` seconds, with its phase carried between samples */
  const sweep = (f0: number, f1: number, glide: number) => {
    let ph = 0
    return (t: number) => {
      const k = Math.min(1, t / glide)
      ph += (TAU * (f0 + (f1 - f0) * k)) / sr
      return Math.sin(ph)
    }
  }
  /** soft noise: white noise through a one-pole lowpass (0 < a < 1, smaller is darker) */
  const soft = (a: number) => {
    let y = 0
    return () => (y += (Math.random() * 2 - 1 - y) * a)
  }

  // the air blower: a rushing jet of air that swirls, with plastic balls clattering against the glass
  const air = soft(0.18)
  const deep = soft(0.02)
  const clacks = Array.from({ length: 90 }, () => ({ at: 0.08 + Math.random() * 2.3, f: 1700 + Math.random() * 1800, v: 0.08 + Math.random() * 0.16 }))
  const whirl = mk(2.5, t => {
    const swirl = 0.6 + 0.25 * Math.sin(TAU * 3.1 * t) + 0.15 * Math.sin(TAU * 7.3 * t + 1)
    let v = (air() * 1.1 * swirl + deep() * 2.6) * Math.min(1, t / 0.3)
    for (const k of clacks) {
      const x = t - k.at
      if (x >= 0 && x < 0.03) v += (Math.sin(TAU * k.f * x) + 0.5 * Math.sin(TAU * k.f * 1.73 * x)) * Math.exp(-x * 190) * k.v
    }
    return v
  })

  // the pneumatic grab: air sucked up the tube, getting brighter, then the ball thuds into the gate
  let y1 = 0
  let y2 = 0
  const thud = sweep(150, 70, 0.06)
  const tok = mk(0.34, t => {
    const a = 0.03 + 0.4 * Math.min(1, t / 0.2)
    const n = Math.random() * 2 - 1
    y1 += (n - y1) * a
    y2 += (n - y2) * 0.02
    let v = (y1 - y2) * Math.sin(Math.PI * Math.min(1, t / 0.22)) * 0.9
    const x = t - 0.2
    if (x >= 0) v += thud(x) * Math.exp(-x * 32) * 0.9 + (x < 0.004 ? n * 0.4 : 0)
    return v
  })

  // the ball shooting up the clear pipe: a fast hollow whoosh with a glassy rattle
  const lo = soft(0.08)
  const hi = soft(0.5)
  const swish = mk(0.4, t => {
    const rattle = 0.55 + 0.45 * Math.sin(TAU * 46 * t)
    return (hi() - lo()) * rattle * Math.sin((Math.PI * t) / 0.4) ** 2 * 1.6
  })

  // the reveal: a bright two-note "ta-ding", E then B, with a sparkle on top
  const note = (f: number, t: number, d: number) =>
    t < 0 ? 0 : (Math.sin(TAU * f * t) + 0.32 * Math.sin(TAU * f * 3 * t) * Math.exp(-t * 18) + 0.18 * Math.sin(TAU * f * 2 * t)) * Math.exp(-t * d)
  const pop = mk(0.6, t => (note(659.3, t, 28) * 0.55 + note(987.8, t - 0.07, 6.5) + 0.25 * Math.sin(TAU * 3951 * t) * (t > 0.07 ? Math.exp(-(t - 0.07) * 22) : 0)) * 0.4)

  // the ball dropping into its cup: a soft thunk and a short ring
  const tone3 = sweep(170, 90, 0.07)
  const land = mk(0.45, t => tone3(t) * Math.exp(-t * 30) * 0.8 + (Math.sin(TAU * 880 * t) * 0.18 + Math.sin(TAU * 1330 * t) * 0.1) * Math.exp(-t * 11) + (t < 0.003 ? (Math.random() * 2 - 1) * 0.25 : 0))

  // one of your numbers: "bling-bling", a rising E – B – E with a coin glint
  const glint = (t: number) => (t < 0 ? 0 : (Math.sin(TAU * 3200 * t) * 0.5 + Math.sin(TAU * 5310 * t) * 0.3 + Math.sin(TAU * 7900 * t) * 0.2) * Math.exp(-t * 26))
  const chime = mk(0.8, t => (note(1318.5, t, 14) * 0.7 + note(1975.5, t - 0.06, 10) * 0.75 + note(2637, t - 0.12, 7) * 0.6 + glint(t - 0.12) * 0.5) * 0.32)

  return { whirl, tok, swish, pop, land, chime }
}

function createSfx() {
  let ctx: AudioContext | undefined
  let master!: GainNode
  let revIn!: GainNode
  let sfxBus!: GainNode
  let musicBus!: GainNode
  let padBus!: GainNode
  let crowdBus!: GainNode
  let noiseBuf!: AudioBuffer
  let kit!: Kit
  const bank: Record<string, AudioBuffer> = {}
  let sfxOn = true
  let musicOn = true
  let crowdOn = true
  let loopT: number | undefined
  let ir!: AudioBuffer
  /** the groove pre-rendered once per mood, so a busy page can never make it stutter */
  const loops: { idle?: AudioBuffer; draw?: AudioBuffer } = {}
  /** the win sounds pre-rendered too: built live they create thousands of nodes at once and stall the page */
  const shots: Record<string, AudioBuffer[]> = {}
  interface Voice {
    src: AudioBufferSourceNode
    g: GainNode
  }
  let loopPlay: { t0: number; idle: Voice; draw?: Voice; drawing: boolean; rec: boolean; lvl: number } | undefined
  let drawing: () => boolean = () => false
  /** level multiplier applied to every envelope while one sound is being scheduled */
  let boost = 1

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    } catch {
      return
    }
    const c = ctx
    master = c.createGain()
    master.gain.value = 2.6
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -20
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.2
    // a brick-wall limiter after the glue compressor keeps the louder mix from clipping
    const limit = c.createDynamicsCompressor()
    limit.threshold.value = -2.5
    limit.knee.value = 0
    limit.ratio.value = 20
    limit.attack.value = 0.001
    limit.release.value = 0.1
    master.connect(comp)
    comp.connect(limit)
    limit.connect(c.destination)

    // a bright hall: decorrelated noise tails, darker towards the end
    const len = Math.floor(c.sampleRate * 2)
    ir = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const k = i / len
        lp += (Math.random() * 2 - 1 - lp) * (0.9 - k * 0.75)
        d[i] = lp * Math.pow(1 - k, 2.8) * (i < c.sampleRate * 0.01 ? i / (c.sampleRate * 0.01) : 1)
      }
    }
    const rev = c.createConvolver()
    rev.buffer = ir
    revIn = c.createGain()
    revIn.connect(rev)
    const wet = c.createGain()
    wet.gain.value = 0.38
    rev.connect(wet)
    wet.connect(master)

    const bus = (v: number, to: AudioNode = master) => {
      const g = c.createGain()
      g.gain.value = v
      g.connect(to)
      return g
    }
    sfxBus = bus(1.5)
    crowdBus = bus(1.4)
    musicBus = bus(MUSIC)
    padBus = bus(1, musicBus)

    kit = makeKit(c)
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

    const load = async (urls: string[]): Promise<AudioBuffer> => {
      for (const url of urls) {
        try {
          // a single-file build inlines clips as data: URLs, which some pages may not fetch
          const b = url.startsWith('data:')
            ? Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), ch => ch.charCodeAt(0)).buffer
            : await (await fetch(url)).arrayBuffer()
          // the callback form, because older Safari has no promise version
          return await new Promise<AudioBuffer>((ok, no) => c.decodeAudioData(b, ok, no))
        } catch {
          // try the next format
        }
      }
      throw new Error('no playable file')
    }
    const music = clipFiles().map(({ name, urls }) =>
      load(urls).then(buf => {
        bank[name] = buf
        if (name.startsWith('music')) syncMusic()
      }),
    )
    setTimeout(() => renderShots().catch(() => {}), 1200)
    // the synthesized groove is only rendered if the recorded music cannot be played
    Promise.allSettled(music).then(() => {
      if (bank.music) return
      renderLoop(false, LOOP_STEPS)
        .then(b => (loops.idle = b))
        .then(() => renderLoop(true, LOOP_STEPS / 2))
        .then(b => (loops.draw = b))
        .catch(() => {})
    })
    clearInterval(loopT)
    loopT = window.setInterval(syncMusic, 200)
  }

  const ok = () => !!ctx && sfxOn && ctx.state === 'running'
  const okM = () => !!ctx && musicOn && ctx.state === 'running'
  const okC = () => !!ctx && crowdOn && ctx.state === 'running'
  const now = () => ctx!.currentTime + 0.01
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)

  /** one buffer through one gain (and a panner if needed), dry: the cheapest way to make a sound */
  function play(buf: AudioBuffer, t: number, o: { vol?: number; pan?: number; rate?: number; dur?: number } = {}) {
    const c = ctx!
    const src = c.createBufferSource()
    src.buffer = buf
    if (o.rate) src.playbackRate.value = o.rate
    const g = c.createGain()
    g.gain.value = o.vol ?? 1
    if (o.dur) {
      g.gain.setValueAtTime(o.vol ?? 1, t + Math.max(0, o.dur - 0.12))
      g.gain.linearRampToValueAtTime(0.0001, t + o.dur)
    }
    src.connect(g)
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, o.pan))
      g.connect(p)
      p.connect(sfxBus)
    } else g.connect(sfxBus)
    src.start(t)
    src.stop(t + (o.dur ?? buf.duration / (o.rate ?? 1)) + 0.02)
  }

  function dest(b: Bus = 'sfx') {
    return b === 'music' ? musicBus : b === 'pad' ? padBus : b === 'crowd' ? crowdBus : sfxBus
  }

  function env(t: number, dur: number, v: number, a: number, sus?: boolean) {
    const g = ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    v *= boost
    g.gain.linearRampToValueAtTime(v, t + a)
    if (sus) {
      g.gain.setValueAtTime(v, Math.max(t + a, t + dur - 0.35))
      g.gain.linearRampToValueAtTime(0.0001, t + dur)
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    return g
  }

  function panner(pan: number) {
    const c = ctx!
    if (!c.createStereoPanner) return null
    const p = c.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    return p
  }

  /** source → filters → envelope → panner → bus, with a reverb send */
  function route(src: AudioNode, g: GainNode, o: Opts) {
    const c = ctx!
    let n = src
    for (const [type, f] of [
      ['lowpass', o.lp],
      ['highpass', o.hp],
    ] as [BiquadFilterType, number | undefined][]) {
      if (!f) continue
      const bq = c.createBiquadFilter()
      bq.type = type
      bq.frequency.value = f
      bq.Q.value = o.q ?? 0.7
      n.connect(bq)
      n = bq
    }
    n.connect(g)
    let last: AudioNode = g
    const p = o.pan ? panner(o.pan) : null
    if (p) {
      g.connect(p)
      last = p
    }
    last.connect(dest(o.bus))
    const s = o.send ?? 0.2
    if (s > 0) {
      const sg = c.createGain()
      sg.gain.value = s
      last.connect(sg)
      sg.connect(revIn)
    }
  }

  function tone(f: number, t: number, dur: number, o: Opts = {}) {
    const c = ctx!
    const os = c.createOscillator()
    os.type = o.type || 'sine'
    os.frequency.setValueAtTime(f, t)
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur * (o.gl ?? 1))
    if (o.det) os.detune.value = o.det
    if (o.vib) {
      const l = c.createOscillator()
      const lg = c.createGain()
      l.frequency.value = 5.5
      lg.gain.value = o.vib
      l.connect(lg)
      lg.connect(os.frequency)
      l.start(t)
      l.stop(t + dur + 0.05)
    }
    route(os, env(t, dur, o.vol ?? 0.1, o.a ?? 0.005, o.sus), o)
    os.start(t)
    os.stop(t + dur + 0.05)
  }

  function noiseSrc(t: number, dur: number) {
    const src = ctx!.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.05)
    return src
  }

  function noise(t: number, dur: number, o: NoiseOpts = {}) {
    const bq = ctx!.createBiquadFilter()
    bq.type = o.ft || 'bandpass'
    bq.frequency.setValueAtTime(o.f0 ?? 1000, t)
    if (o.f1) bq.frequency.exponentialRampToValueAtTime(o.f1, t + dur)
    bq.Q.value = o.q ?? 1
    noiseSrc(t, dur).connect(bq)
    route(bq, env(t, dur, o.vol ?? 0.1, o.a ?? 0.003, o.sus), { ...o, lp: undefined, hp: undefined })
  }

  /** the clip `name`, or a random take of it (name-1, name-2…) */
  function take(name: string) {
    if (bank[name]) return bank[name]
    const all: AudioBuffer[] = []
    for (let k = 1; bank[name + '-' + k]; k++) all.push(bank[name + '-' + k])
    return all.length ? all[Math.floor(Math.random() * all.length)] : undefined
  }

  /** play a recorded clip if one was supplied; false means use the synthesized sound */
  function clip(name: string, t: number, o: ClipOpts = {}) {
    const buf = take(name)
    if (!buf) return false
    const c = ctx!
    const src = c.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = o.rate ?? 1
    const g = c.createGain()
    // clips are levelled by CLIP_VOL, not by the synth trims
    const v = (o.vol ?? 1) * (CLIP_VOL[name] ?? 1)
    g.gain.setValueAtTime(v, t)
    if (o.dur) {
      g.gain.setValueAtTime(v, t + Math.max(0, o.dur - 0.15))
      g.gain.linearRampToValueAtTime(0.0001, t + o.dur)
    }
    src.connect(g)
    const p = o.pan ? panner(o.pan) : null
    if (p) {
      g.connect(p)
      p.connect(dest(o.bus))
    } else g.connect(dest(o.bus))
    src.start(t)
    if (o.dur) src.stop(t + o.dur + 0.05)
    return true
  }

  /** FM bell: a bright strike that melts into a pure tone */
  function bell(f: number, t: number, v: number, dur = 1.4, o: Opts = {}, ratio = 3.5, idx = 2.2) {
    const c = ctx!
    const car = c.createOscillator()
    const mod = c.createOscillator()
    const mg = c.createGain()
    car.frequency.value = f
    mod.frequency.value = f * ratio
    mg.gain.setValueAtTime(f * idx, t)
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.5)
    mod.connect(mg)
    mg.connect(car.frequency)
    route(car, env(t, dur, v, 0.002), { send: 0.35, ...o })
    car.start(t)
    mod.start(t)
    car.stop(t + dur + 0.05)
    mod.stop(t + dur + 0.05)
  }

  /** electric piano: a soft FM tine with a slow tremolo, on the pad bus so the kick-free mix still breathes */
  function rhodes(f: number, t: number, dur: number, v: number, pan = 0) {
    bell(f, t, v, dur, { bus: 'pad', pan, send: 0.3 }, 1, 1.1)
    tone(f, t, dur * 0.8, { vol: v * 0.35, vib: 2.5, a: 0.01, pan, send: 0.2, bus: 'pad' })
  }
  /** vibraphone: a mellow bar with the motor's shimmer */
  function vibes(f: number, t: number, v: number, dur = 0.9, pan = 0.2) {
    bell(f, t, v, dur, { bus: 'music', pan, send: 0.45 }, 4, 0.9)
    tone(f, t, dur, { vol: v * 0.6, vib: 6, a: 0.003, pan, send: 0.4, bus: 'music' })
  }
  /** the groove's kick: round and soft, felt more than heard */
  function thump(t: number, v: number) {
    tone(118, t, 0.3, { vol: v, to: 44, gl: 0.3, a: 0.002, send: 0, bus: 'music' })
    noise(t, 0.008, { ft: 'highpass', f0: 2500, vol: v * 0.15, send: 0, bus: 'music' })
  }
  /** a tight, roomy clap on 2 and 4 */
  function snap(t: number, v: number) {
    ;[0, 0.009, 0.019].forEach((d, k) => noise(t + d, k === 2 ? 0.12 : 0.02, { f0: 1500, q: 1.1, vol: v * (k === 2 ? 1 : 0.6), a: 0.001, bus: 'music', send: 0.3, pan: 0.1 }))
  }
  /** shaker: a short bright grain, panned a little right */
  function shaker(t: number, v: number) {
    noise(t, 0.045, { ft: 'highpass', f0: 7000, vol: v, a: 0.006, bus: 'music', send: 0.05, pan: 0.3 })
  }
  /** synth bass: a rounded saw over a sine sub */
  function bass(f: number, t: number, v: number, dur = S16 * 1.7) {
    tone(f, t, dur, { vol: v, type: 'sawtooth', lp: 520, q: 1.5, a: 0.004, send: 0, bus: 'music' })
    tone(f, t, dur, { vol: v * 0.9, a: 0.004, send: 0, bus: 'music' })
  }
  /** a warm pad chord: detuned saws through a soft filter, swelling in */
  function pad(ch: number[], t: number, dur: number, v: number) {
    ch.forEach((m, k) => {
      const pan = -0.45 + k * 0.3
      ;[-7, 7].forEach(d => tone(mtof(m), t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.25, lp: 1100, q: 0.5, pan, send: 0.5, sus: true, bus: 'pad' }))
    })
  }
  /** marimba: a woody bar with a quick knock */
  function mallet(f: number, t: number, v: number, pan = 0.15) {
    bell(f, t, v, 0.55, { bus: 'music', pan, send: 0.35 }, 4, 0.7)
    tone(f, t, 0.45, { vol: v * 0.7, a: 0.002, pan, send: 0.3, bus: 'music' })
  }
  /** timpani: a tuned drum with a boom and a skin slap */
  function timp(f: number, t: number, v: number, dur = 1.6) {
    tone(f, t, dur, { vol: v, to: f * 0.97, a: 0.004, send: 0.4 })
    tone(f * 1.5, t, dur * 0.5, { vol: v * 0.35, a: 0.004, send: 0.3 })
    noise(t, 0.08, { f0: 300, q: 0.8, vol: v * 0.5, send: 0.2 })
  }
  /** a timpani roll that swells for `d` seconds */
  function timpRoll(f: number, t: number, d: number, v: number) {
    for (let x = 0; x < d; x += 0.055) timp(f, t + x, v * (0.25 + 0.75 * (x / d)), 0.3)
  }
  /** a French-horn-like note: warm, slow to speak, slightly breathy */
  function horn(f: number, t: number, dur: number, v: number, pan = 0) {
    ;[-6, 6].forEach(d => tone(f, t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.05, lp: 1500, q: 0.8, pan, send: 0.45, sus: true }))
    tone(f / 2, t, dur, { vol: v * 0.6, a: 0.06, pan, send: 0.4, sus: true })
  }
  /** harp glissando over the given notes */
  function gliss(notes: number[], t: number, v: number, gap = 0.04) {
    notes.forEach((m, k) => {
      const f = mtof(m)
      const pan = -0.6 + (1.2 * k) / notes.length
      tone(f, t + k * gap, 1.1, { vol: v, a: 0.002, pan, send: 0.5 })
      tone(f * 2, t + k * gap, 0.4, { vol: v * 0.3, a: 0.002, pan, send: 0.4 })
    })
  }

  /** a metal coin: inharmonic partials and a bright scrape */
  function clink(f: number, t: number, v: number, pan = 0) {
    ;[1, 2.76, 5.4, 8.93].forEach((r, k) => tone(f * r, t, 0.5 / (k + 1), { vol: v / (k + 1.4), a: 0.001, pan, send: 0.3 }))
    noise(t, 0.04, { ft: 'highpass', f0: 7000, vol: v * 0.6, pan })
  }

  /** two plastic balls knocking together */
  function kick(t: number, v: number, bus: Bus = 'music') {
    tone(150, t, 0.3, { vol: v, to: 45, gl: 0.45, a: 0.002, send: 0, bus })
    noise(t, 0.012, { ft: 'highpass', f0: 3000, vol: v * 0.25, send: 0, bus })
  }
  function snare(t: number, v: number) {
    tone(200, t, 0.1, { vol: v * 0.6, to: 140, a: 0.001, send: 0.1, bus: 'music' })
    noise(t, 0.16, { ft: 'highpass', f0: 1800, vol: v, a: 0.001, send: 0.25, bus: 'music' })
  }
  function hat(t: number, v: number, open = false) {
    noise(t, open ? 0.16 : 0.035, { ft: 'highpass', f0: 8500, vol: v, bus: 'music', send: 0.08, pan: open ? 0.25 : -0.2 })
  }
  function crash(t: number, v: number, dur = 2.2) {
    noise(t, dur, { ft: 'highpass', f0: 5200, f1: 3500, vol: v, a: 0.002, send: 0.5 })
    noise(t, dur * 0.5, { f0: 9000, q: 0.6, vol: v * 0.5, send: 0.3 })
  }
  function brass(f: number, t: number, dur: number, v: number, pan = 0, bus: Bus = 'sfx') {
    ;[-9, 0, 9].forEach(d => tone(f, t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.03, lp: 2800, q: 1.2, pan, send: 0.35, bus }))
  }

  /** a kalimba-like pluck: a warm tine with a woody knock */
  function kalimba(f: number, t: number, v: number, pan: number, dur = 1.1) {
    tone(f, t, dur, { vol: v, a: 0.002, pan, send: 0.35 })
    tone(f * 5.4, t, 0.09, { vol: v * 0.25, a: 0.001, pan, send: 0.2 })
    tone(f * 2, t, dur * 0.4, { vol: v * 0.18, a: 0.002, pan, send: 0.3 })
    noise(t, 0.02, { f0: 1800, q: 2, vol: v * 0.5, pan, send: 0.1 })
  }
  // ---- draw-show instruments ----
  /** a plucked synth: a filtered square that snaps shut, with a little octave on top */
  function pluck(f: number, t: number, v: number, pan = 0, bus: Bus = 'music', dur = 0.22) {
    tone(f, t, dur, { vol: v, type: 'square', lp: 2400, q: 2, a: 0.002, pan, send: 0.3, bus })
    tone(f * 2, t, dur * 0.4, { vol: v * 0.35, a: 0.002, pan, send: 0.25, bus })
  }
  /** a wide supersaw chord stab, like a TV show sting */
  function stab(ch: number[], t: number, dur: number, v: number, bus: Bus = 'sfx') {
    ch.forEach((m, k) => {
      const pan = -0.5 + (k / Math.max(1, ch.length - 1)) * 1
      ;[-14, 0, 14].forEach(d => tone(mtof(m), t, dur, { vol: v, type: 'sawtooth', det: d, a: 0.006, lp: 3600, q: 0.9, pan, send: 0.45, bus }))
    })
  }
  /** a white-noise riser that sweeps up to the hit */
  function riser(t: number, d: number, v: number, bus: Bus = 'sfx') {
    const c = ctx!
    const bq = c.createBiquadFilter()
    bq.type = 'bandpass'
    bq.Q.value = 1.4
    bq.frequency.setValueAtTime(350, t)
    bq.frequency.exponentialRampToValueAtTime(7000, t + d)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v * boost, t + d)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08)
    noiseSrc(t, d + 0.1).connect(bq)
    route(bq, g, { bus, send: 0.4 })
  }
  /** a siren that wails up and down `n` times */
  function siren(t: number, n: number, v: number, lo = 620, hi = 1240, cyc = 0.42) {
    const c = ctx!
    const os = c.createOscillator()
    os.type = 'sawtooth'
    os.frequency.setValueAtTime(lo, t)
    for (let k = 0; k < n; k++) {
      os.frequency.linearRampToValueAtTime(hi, t + k * cyc + cyc * 0.55)
      os.frequency.linearRampToValueAtTime(lo, t + (k + 1) * cyc)
    }
    const d = n * cyc
    route(os, env(t, d, v, 0.03, true), { lp: 2600, q: 1.5, send: 0.35 })
    os.start(t)
    os.stop(t + d + 0.05)
  }
  /** a snare drumroll that swells for `d` seconds */
  function roll(t: number, d: number, v: number) {
    for (let x = 0; x < d; x += 0.032) {
      const k = x / d
      noise(t + x, 0.06, { ft: 'highpass', f0: 1900, vol: v * (0.2 + 0.8 * k * k), a: 0.001, send: 0.2 })
      tone(220, t + x, 0.04, { vol: v * 0.3 * (0.2 + 0.8 * k), to: 160, a: 0.001, send: 0 })
    }
  }
  /** a big hit: kick, sub boom and a cymbal */
  function impact(t: number, v: number) {
    tone(140, t, 0.6, { vol: v, to: 38, gl: 0.4, a: 0.002, send: 0.1 })
    noise(t, 0.05, { f0: 2500, q: 0.7, vol: v * 0.4, send: 0.2 })
    crash(t, v * 0.18, 2)
  }
  /** a short slot-machine reel click */
  function ratchet(t: number, v: number, pan = 0) {
    noise(t, 0.018, { f0: 3200, q: 3, vol: v, a: 0.001, pan, send: 0.05 })
    tone(1900, t, 0.02, { vol: v * 0.4, type: 'square', lp: 4000, a: 0.001, pan, send: 0 })
  }
  // ---- crowd ----
  /**
   * One person shouting "wooo-yeah!": a voiced buzz with a little breath, gliding up in pitch,
   * through three vowel formants that open from "oo" to "ah".
   */
  function voice(t: number, f0: number, dur: number, v: number, pan: number, female: boolean) {
    const c = ctx!
    const os = c.createOscillator()
    os.type = 'sawtooth'
    const peak = f0 * rnd(1.35, 1.7)
    os.frequency.setValueAtTime(f0, t)
    os.frequency.exponentialRampToValueAtTime(peak, t + dur * 0.35)
    os.frequency.exponentialRampToValueAtTime(peak * 0.82, t + dur)
    // a shaky, excited voice
    const lfo = c.createOscillator()
    lfo.frequency.value = rnd(5, 7.5)
    const lg = c.createGain()
    lg.gain.value = f0 * 0.035
    lfo.connect(lg)
    lg.connect(os.frequency)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v * boost, t + 0.07)
    g.gain.setValueAtTime(v * boost, t + dur * 0.55)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const sh = female ? 1.18 : 1
    // [start (oo), end (ah), Q, level]
    const fm: [number, number, number, number][] = [
      [330 * sh, 780 * sh, 7, 1],
      [880 * sh, 1250 * sh, 9, 0.6],
      [2400 * sh, 2700 * sh, 10, 0.25],
    ]
    const breath = noiseSrc(t, dur + 0.05)
    const bg = c.createGain()
    bg.gain.value = 0.25
    breath.connect(bg)
    for (const [a, b2, q, l] of fm) {
      const bq = c.createBiquadFilter()
      bq.type = 'bandpass'
      bq.Q.value = q
      bq.frequency.setValueAtTime(a, t)
      bq.frequency.exponentialRampToValueAtTime(b2, t + dur * 0.3)
      const fg = c.createGain()
      fg.gain.value = l
      os.connect(bq)
      bg.connect(bq)
      bq.connect(fg)
      fg.connect(g)
    }
    route(g, c.createGain(), { pan, bus: 'crowd', send: 0.3 })
    os.start(t)
    lfo.start(t)
    os.stop(t + dur + 0.05)
    lfo.stop(t + dur + 0.05)
  }
  /** a two-note wolf whistle: "fweet-fwoo" */
  function whistle(t: number, v: number) {
    const f = rnd(1700, 2300)
    const pan = rnd(-0.7, 0.7)
    tone(f * 0.7, t, 0.22, { vol: v, to: f * 1.25, gl: 0.18, a: 0.02, pan, bus: 'crowd', send: 0.3 })
    tone(f * 1.2, t + 0.3, 0.45, { vol: v, to: f * 0.55, gl: 0.42, a: 0.02, pan, bus: 'crowd', send: 0.3 })
  }
  /** one pair of hands: a crisp, bright double transient */
  function handClap(t: number, v: number, pan: number) {
    const f = rnd(1200, 3200)
    noise(t, rnd(0.012, 0.025), { f0: f, q: rnd(1, 2.2), vol: v, a: 0.0005, pan, bus: 'crowd', send: 0.15 })
    noise(t + 0.006, 0.02, { ft: 'highpass', f0: 4000, vol: v * 0.35, a: 0.0005, pan, bus: 'crowd', send: 0.1 })
  }
  /**
   * A studio audience cheering: a wave of "wooo!" voices, wolf whistles and dense applause
   * that swells, holds, then thins out. Only a light wash of noise underneath, so the voices
   * and claps stay clear.
   */
  function crowd(t: number, d: number, size: number) {
    // applause: lots of claps a second, louder at the front, fading out at the end
    const rate = 70 * size
    for (let k = 0, n = Math.floor(rate * d); k < n; k++) {
      const x = Math.random() * d
      const lvl = Math.min(1, x / 0.2) * (x > d * 0.55 ? Math.max(0, 1 - (x - d * 0.55) / (d * 0.45)) : 1)
      handClap(t + x, 0.11 * (0.25 + 0.75 * lvl) * rnd(0.5, 1), rnd(-0.95, 0.95))
    }
    // a soft wash of the room under it
    noise(t, d, { f0: 1600, q: 0.5, vol: 0.018 * size, a: 0.15, bus: 'crowd', send: 0.4 })
    // the shouts: most in the first second, a few late ones
    const n = Math.round(22 * size)
    for (let k = 0; k < n; k++) {
      const fem = k % 2 === 1
      const f = fem ? rnd(230, 330) : rnd(120, 190)
      const late = k > n * 0.75
      voice(t + (late ? rnd(0.7, 1.4) : rnd(0, 0.35)), f, rnd(0.6, 1.1), 0.05 * rnd(0.6, 1), rnd(-0.9, 0.9), fem)
    }
    for (let k = 0; k < Math.max(1, Math.round(3 * size)); k++) whistle(t + 0.15 + Math.random() * d * 0.5, 0.03)
  }
  /** pull the music down under a big moment */
  function duck(t: number, depth: number, hold: number) {
    const g = musicBus.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(MUSIC, t)
    g.linearRampToValueAtTime(MUSIC * depth, t + 0.05)
    g.setValueAtTime(MUSIC * depth, t + hold)
    g.linearRampToValueAtTime(MUSIC, t + hold + 0.6)
  }

  // ---- the groove ----
  /** eight bars while waiting (the hook plays every other time round); the draw loop is half that */
  const LOOP_STEPS = 128

  /** Render one synthesized sound offline (sfx, crowd and reverb), at the level `trim` (dB). */
  async function renderShot(dur: number, trim: number, fn: (t: number) => void) {
    const real = { ctx, revIn, sfxBus, crowdBus }
    const sr = real.ctx!.sampleRate
    const off = new OfflineAudioContext(2, Math.round(sr * dur), sr)
    const rv = off.createConvolver()
    rv.buffer = ir
    const wet = off.createGain()
    wet.gain.value = 0.38
    rv.connect(wet)
    wet.connect(off.destination)
    ctx = off as unknown as AudioContext
    revIn = off.createGain()
    revIn.connect(rv)
    sfxBus = off.createGain()
    sfxBus.gain.value = 1.5
    sfxBus.connect(off.destination)
    crowdBus = off.createGain()
    crowdBus.gain.value = 1.4
    crowdBus.connect(off.destination)
    boost = db(trim)
    try {
      fn(0.02)
    } finally {
      boost = 1
      ;({ ctx, revIn, sfxBus, crowdBus } = real)
    }
    return off.startRendering()
  }
  /** two takes of each win sound, rendered one at a time while the page is quiet */
  async function renderShots() {
    const jobs: [string, number, number, (t: number) => void][] = [
      ['bingo', 2.6, TRIM.bingo, fanfare],
      ['cheer-big', 3.8, TRIM.cheer, t => crowd(t, 2.6, 1)],
      ['cheer-small', 3.1, TRIM.cheer, t => crowd(t, 1.9, 0.7)],
    ]
    for (let take = 0; take < 2; take++)
      for (const [name, dur, trim, fn] of jobs) {
        const b = await renderShot(dur, trim, fn)
        ;(shots[name] ||= []).push(b)
      }
  }
  /** play a pre-rendered win sound straight into the mix; false if it isn't ready yet */
  function shot(name: string, t: number) {
    const all = shots[name]
    if (!all?.length) return false
    const c = ctx!
    const src = c.createBufferSource()
    src.buffer = all[Math.floor(Math.random() * all.length)]
    src.connect(master)
    src.start(t)
    return true
  }
  /** the win fanfare: ringing slot bells, a brass call, a big stab and a coin shower */
  function fanfare(t: number) {
    impact(t, 0.4)
    // the slot bells: two pitches ringing in turn
    for (let k = 0; k < 10; k++) bell(mtof(k % 2 ? 91 : 88), t + 0.05 + k * 0.075, 0.03, 0.35, { pan: k % 2 ? 0.45 : -0.45 }, 3.01, 1.6)
    // E – E – E – B, then a held E major chord
    ;[[76, 0], [76, 0.14], [76, 0.28], [83, 0.42]].forEach(([m, d]) => brass(mtof(m), t + 0.1 + d, 0.12, 0.022))
    stab([52, 56, 59, 64, 68, 71], t + 0.72, 0.8, 0.011)
    impact(t + 0.72, 0.3)
    // the coin shower
    for (let k = 0; k < 18; k++) clink(rnd(2500, 3800), t + 0.75 + k * 0.07 + Math.random() * 0.04, 0.025 * (1 - k / 24), rnd(-0.8, 0.8))
  }

  /**
   * Render the groove offline. The tail that rings past the end is folded back
   * onto the start, so the buffer loops without a seam.
   */
  async function renderLoop(draw: boolean, steps: number) {
    const real = { ctx, revIn, musicBus, padBus }
    const sr = real.ctx!.sampleRate
    const n = Math.round(steps * S16 * sr)
    const off = new OfflineAudioContext(2, n + sr * 2, sr)
    const rv = off.createConvolver()
    rv.buffer = ir
    const wet = off.createGain()
    // the loop is played through the music bus, so take its gain back out of the reverb
    wet.gain.value = 0.38 / MUSIC
    rv.connect(wet)
    wet.connect(off.destination)
    ctx = off as unknown as AudioContext
    revIn = off.createGain()
    revIn.connect(rv)
    musicBus = off.createGain()
    musicBus.connect(off.destination)
    padBus = off.createGain()
    padBus.connect(musicBus)
    try {
      for (let s = 0; s < steps; s++) beat(s % 64, s * S16, draw, s >> 6)
    } finally {
      ;({ ctx, revIn, musicBus, padBus } = real)
    }
    const out = await off.startRendering()
    const buf = real.ctx!.createBuffer(2, n, sr)
    for (let ch = 0; ch < 2; ch++) {
      const src = out.getChannelData(ch)
      const dst = buf.getChannelData(ch)
      dst.set(src.subarray(0, n))
      for (let i = n; i < src.length; i++) dst[i - n] += src[i]
    }
    return buf
  }

  /** start, stop and crossfade the music to match the settings and the game */
  function syncMusic() {
    if (!ctx) return
    const c = ctx
    const stop = () => {
      loopPlay?.idle.src.stop()
      loopPlay?.draw?.src.stop()
      loopPlay = undefined
    }
    if (!okM()) return stop()
    // the recorded loops when they loaded, otherwise the synthesized ones
    const rec = !!bank.music
    const idle = rec ? bank.music : loops.idle
    const draw = rec ? bank['music-draw'] : loops.draw
    const lvl = rec ? CLIP_VOL.music : 0.65
    if (loopPlay && loopPlay.rec !== rec) stop()
    const t = c.currentTime + 0.05
    // both loops run against the same clock, so switching between them lands on the beat
    const voice = (b: AudioBuffer, v: number, t0: number): Voice => {
      const src = c.createBufferSource()
      src.buffer = b
      src.loop = true
      const g = c.createGain()
      g.gain.value = v
      src.connect(g)
      g.connect(musicBus)
      src.start(t, (t - t0) % b.duration)
      return { src, g }
    }
    const d = drawing()
    if (!loopPlay) {
      if (!idle) return
      loopPlay = { t0: t, idle: voice(idle, lvl, t), drawing: false, rec, lvl }
    }
    if (!loopPlay.draw && draw) loopPlay.draw = voice(draw, 0, loopPlay.t0)
    if (loopPlay.draw && loopPlay.drawing !== d) {
      loopPlay.drawing = d
      // switch on the next beat, with a short crossfade
      const at = nextBeat(c.currentTime + 0.02)
      loopPlay.idle.g.gain.setTargetAtTime(d ? 0 : lvl, at, 0.06)
      loopPlay.draw.g.gain.setTargetAtTime(d ? lvl : 0, at, 0.06)
    }
  }

  /** the first beat (every `every` beats) of the music at or after time t */
  function nextBeat(t: number, every = 1) {
    if (!loopPlay) return t
    const b = (S16 * 4) * every
    return loopPlay.t0 + Math.ceil((t - loopPlay.t0 - 0.001) / b) * b
  }

  function beat(s: number, t: number, draw: boolean, cycle: number) {
    const bar = (s >> 4) & 3
    const p = s & 15
    const ch = PROG[bar]
    const root = mtof(ROOT[bar])
    // four-on-the-floor, a clap on 2 and 4 once the draw is on
    if (p % 4 === 0) thump(t, draw ? 0.3 : 0.22)
    if (p === 4 || p === 12) snap(t, draw ? 0.11 : 0.05)
    // an open hat on every off-beat, and ticking 16ths while drawing
    if (p % 4 === 2) hat(t, draw ? 0.05 : 0.04, true)
    else if (draw) hat(t, p % 2 ? 0.018 : 0.026)
    // pumping bass: off-beat 8ths while waiting, rolling 16ths between the kicks while drawing
    if (draw ? p % 4 !== 0 : p % 4 === 2) bass(draw && p % 2 ? root * 2 : root, t, draw ? 0.11 : 0.12, S16 * 0.9)
    // a held pad chord per bar
    if (p === 0) pad(ch, t, S16 * 15.5, draw ? 0.008 : 0.012)
    // the hook while waiting, a driving arpeggio while drawing
    if (draw) {
      pluck(mtof(ch[ARP[p % 8]] + 12), t, p % 4 === 0 ? 0.03 : 0.02, Math.sin(s * 0.7) * 0.45)
    } else if (p % 2 === 0) {
      const m = HOOK[cycle & 1][bar][p / 2]
      if (m) pluck(mtof(m), t, 0.034, 0.15, 'music', 0.3)
    }
    // a riser into the top of every loop while drawing
    if (draw && s === 56) riser(t, S16 * 8, 0.035, 'music')
    // a sparkle at the top of every loop
    if (s === 0 && cycle === 0) bell(mtof(88), t, 0.012, 1.6, { bus: 'music', pan: 0.4, send: 0.6 }, 3.5, 1.5)
  }

  /** seconds between scheduling a sound and hearing it: the output latency of the device */
  function lag() {
    if (!ctx) return 0
    const c = ctx as AudioContext & { outputLatency?: number }
    return Math.min(0.3, (c.outputLatency || 0) + (c.baseLatency || 0))
  }

  const api = {
    init,
    /**
     * How long from now (ms) a sound scheduled with `at` can be heard at the earliest.
     * Animations that have sounds start this much later, so picture and sound land together.
     */
    leadMs() {
      return ok() ? Math.round((lag() + 0.03) * 1000) : 0
    },
    /** the audio-clock time to schedule a sound at so it is heard at performance.now() time `p` */
    at(p: number) {
      if (!ctx) return 0
      return ctx.currentTime + (p - performance.now()) / 1000 - lag()
    },
    /** The music gets busier while numbers are being drawn. */
    bindDrawing(fn: () => boolean) {
      drawing = fn
    },
    set(k: 'sfx' | 'music' | 'crowd', v: boolean) {
      init()
      if (k === 'sfx') sfxOn = crowdOn = v
      if (k === 'music') musicOn = v
      if (k === 'crowd') crowdOn = v
      if (ctx) syncMusic()
    },
    // ---- the balls: tiny sounds made once (see makeKit), each played as one buffer ----
    /** the air blower roaring with balls clattering, with the motor whining up, for dur seconds */
    whirl(dur = 1.5) {
      if (!ok()) return
      const t = now()
      const d = Math.min(dur, kit.whirl.duration)
      play(kit.whirl, t, { vol: 0.05, dur: d })
      tone(180, t, d, { vol: 0.006, to: 520, gl: 0.7, type: 'sawtooth', lp: 900, a: 0.3, sus: true, send: 0.1 })
    },
    /** pipe i grabs its ball: a pneumatic suck and thud, then a whoosh up the pipe */
    slide(i = 0, _dur = 1.1, at?: number) {
      if (!ok()) return
      const t = at ?? now()
      const pan = (i - 3) / 3.5
      play(kit.tok, t, { vol: 0.02, pan, rate: rnd(0.95, 1.06) })
      play(kit.swish, t + 0.2, { vol: 0.008, pan, rate: 1.15 })
    },
    /** the ball is revealed in the tray: a bright "ta-ding" that climbs the E minor pentatonic across the slots */
    ding(i: number, at?: number) {
      if (!ok()) return
      play(kit.pop, at ?? now(), { vol: 0.16, pan: (i - 3) / 3.5, rate: POP_STEPS[i % POP_STEPS.length] })
    },
    /** the ball settles in the tray under its hole */
    land(_n: number, i: number, at?: number) {
      if (!ok()) return
      play(kit.land, at ?? now(), { vol: 0.16, pan: (i - 3) / 3.5, rate: rnd(0.95, 1.05) })
    },
    /** one of your numbers came up: "bling-bling" */
    hit(at?: number) {
      if (!ok()) return
      play(kit.chime, at ?? now(), { vol: 0.7 })
    },
    /** end of a round you won: the studio crowd, a confetti cannon and party horns */
    cheer(big: boolean) {
      if (!okC()) return
      const t = now()
      if (clip(big ? 'cheer' : 'cheer-small', t, { bus: 'crowd', dur: big ? 2.5 : 1.8 })) return
      duck(t, 0.1, big ? 2.6 : 1.9)
      // only the pre-rendered crowd: building it live stalls the page
      shot(big ? 'cheer-big' : 'cheer-small', t)
    },
    /** a near miss: a muted "wah-wah-wah-waaah" that's more cheeky than sad */
    aww() {
      if (!ok()) return
      const t = now()
      ;[
        [64, 0, 0.22],
        [63, 0.26, 0.22],
        [62, 0.52, 0.22],
        [61, 0.78, 0.75],
      ].forEach(([m, d, l], k) =>
        tone(mtof(m), t + d, l, { vol: 0.045, to: k === 3 ? mtof(m - 1) : undefined, type: 'sawtooth', lp: 900, q: 4, vib: k === 3 ? 9 : 0, a: 0.03, sus: true, send: 0.3 }),
      )
    },
    star(i: number) {
      if (!ok()) return
      const t = now()
      if (clip('star-' + (Math.min(3, i) + 1), t, { vol: CLIP_VOL.star })) return
      const m = [76, 79, 83, 88][Math.min(3, i)]
      pluck(mtof(m + 12), t, 0.05, 0, 'sfx', 0.4)
      bell(mtof(m + 24), t + 0.04, 0.03, 0.8, {}, 4, 1.2)
    },
    /** several of your numbers at once: a quick arpeggio up into a stab */
    combo(n: number) {
      if (!ok()) return
      const t = now()
      const run = [76, 79, 83, 88, 91, 95, 100]
      const steps = Math.min(run.length, n + 3)
      run.slice(0, steps).forEach((m, k) => pluck(mtof(m), t + k * 0.05, 0.05, -0.5 + k * 0.17, 'sfx'))
      stab([64, 67, 71, 76], t + steps * 0.05, 0.4, 0.012)
    },
    /** one number away: a heartbeat under a rising riser and a trembling tension chord */
    near() {
      if (!ok()) return
      const t = now()
      if (clip('near', t)) return
      ;[0, 0.22, 0.75, 0.97].forEach((d, k) => tone(k % 2 ? 62 : 70, t + d, 0.32, { vol: k % 2 ? 0.2 : 0.28, to: 40, a: 0.004, send: 0.1 }))
      riser(t + 0.1, 1.35, 0.05)
      ;[0, 1].forEach(k => tone(mtof(64 + k * 6), t, 1.5, { vol: 0.016, type: 'sawtooth', lp: 1800, vib: 14, a: 0.6, sus: true, pan: k ? 0.4 : -0.4, send: 0.5 }))
      bell(mtof(88), t + 1.45, 0.06, 1, {}, 4, 1.2)
    },
    /** countdown: the studio clock's electronic beeps, with a long high beep and a whoosh at the end */
    tick(k: number) {
      if (!ok()) return
      const t = now()
      if (clip('tick', t, { rate: k % 2 ? 1 : 0.84 })) return
      if (k <= 1) {
        tone(1568, t, 0.5, { vol: 0.07, type: 'square', lp: 4200, a: 0.002, sus: true, send: 0.3 })
        tone(784, t, 0.5, { vol: 0.05, a: 0.002, sus: true, send: 0.2 })
        riser(t, 0.9, 0.04)
      } else {
        tone(1046.5, t, 0.11, { vol: 0.07, type: 'square', lp: 3800, a: 0.002, sus: true, send: 0.15 })
        tone(523, t, 0.11, { vol: 0.04, a: 0.002, sus: true, send: 0.1 })
        if (k <= 3) tone(90, t, 0.18, { vol: 0.12, to: 50, send: 0 })
      }
    },
    /** taking a card: a crisp card snap and a bright blip */
    pop() {
      if (!ok()) return
      const t = now()
      if (clip('card', t, { rate: rnd(0.95, 1.08) })) return
      noise(t, 0.03, { f0: 2200, q: 1.2, vol: 0.12, a: 0.001, send: 0.1 })
      tone(240, t, 0.07, { vol: 0.08, to: 160, a: 0.002, send: 0.05 })
      pluck(mtof(88), t + 0.02, 0.04, 0, 'sfx', 0.18)
      pluck(mtof(95), t + 0.07, 0.03, 0, 'sfx', 0.22)
    },
    /** swiping between cards: a short airy whoosh */
    swipe() {
      if (!ok()) return
      const t = now()
      const pan = rnd(-0.4, 0.4)
      if (clip('swipe', t, { pan, rate: rnd(0.95, 1.1) })) return
      noise(t, 0.22, { f0: 700, f1: 5200, q: 1.1, vol: 0.07, a: 0.06, pan, send: 0.2 })
    },
    /** quick pick: slot reels spin, then click into place on a ding */
    deal() {
      if (!ok()) return
      const t = now()
      if (clip('deal', t)) return
      for (let k = 0; k < 10; k++) ratchet(t + k * 0.035 * (1 + k * 0.08), 0.05, -0.4 + k * 0.08)
      pluck(mtof(83), t + 0.48, 0.05, 0, 'sfx', 0.3)
      bell(mtof(95), t + 0.5, 0.035, 0.9, {}, 4, 1.2)
    },
    /** a sparkling run */
    shimmer() {
      if (!ok()) return
      const t = now()
      ;[76, 79, 83, 86, 88, 91, 95, 98].forEach((m, k) => pluck(mtof(m), t + k * 0.03, 0.03, -0.6 + k * 0.17, 'sfx', 0.3))
    },
    /** paying: a cash register, drawer thud, bell and a few coins */
    coin() {
      if (!ok()) return
      const t = now()
      if (clip('coin', t)) return
      for (let k = 0; k < 3; k++) ratchet(t + k * 0.03, 0.05)
      tone(120, t + 0.1, 0.12, { vol: 0.12, to: 70, a: 0.002, send: 0.05 })
      noise(t + 0.1, 0.06, { f0: 900, q: 0.8, vol: 0.06 })
      bell(mtof(96), t + 0.12, 0.06, 1.1, {}, 2.76, 2.2)
      bell(mtof(103), t + 0.12, 0.03, 0.8, {}, 2.76, 2)
      for (let k = 0; k < 5; k++) clink(rnd(2700, 3500), t + 0.2 + k * 0.05 + Math.random() * 0.02, 0.045 * (1 - k * 0.12), rnd(-0.5, 0.5))
    },
    /** the draw starts: a snare drumroll swelling into a big hit and a show-opening stab. Returns the seconds until the hit. */
    go() {
      if (!ok()) return 0
      const t = now()
      // the hit lands on a beat of the music
      const hit = nextBeat(t + 0.7)
      const r = hit - t
      roll(t, r, 0.09)
      riser(t, r, 0.04)
      impact(hit, 0.35)
      stab([52, 59, 64, 67, 71], hit, 0.7, 0.012)
      // E – G – B – E brass call
      ;[76, 79, 83].forEach((m, k) => brass(mtof(m), hit + 0.2 + k * 0.1, 0.1, 0.018, (k - 1) * 0.3))
      brass(mtof(88), hit + 0.5, 0.55, 0.02)
      return hit - ctx!.currentTime + lag()
    },
    /** round over: a closing sting, falling to a held chord over a low boom */
    end() {
      if (!ok()) return
      const t = now()
      if (clip('end', t)) return
      ;[83, 81, 79, 76].forEach((m, k) => pluck(mtof(m), t + k * 0.13, 0.045, 0.3 - k * 0.2, 'sfx', 0.35))
      tone(82, t + 0.52, 1.2, { vol: 0.14, to: 41, a: 0.004, send: 0.2 })
      stab([52, 55, 59, 64], t + 0.52, 1.4, 0.007)
    },
    /** a win: ringing slot bells, a brass call, a big stab and a coin shower (the crowd comes from cheer()) */
    bingo() {
      if (!ctx || ctx.state !== 'running') return
      const t = now()
      duck(t, 0.12, 1)
      if (ok() && !clip('jackpot', t) && !shot('bingo', t)) {
        // not rendered yet: a light live version
        impact(t, 0.4)
        ;[[76, 0], [76, 0.14], [76, 0.28], [83, 0.42]].forEach(([m, d]) => brass(mtof(m), t + 0.1 + d, 0.12, 0.022))
      }
      // the crowd follows from cheer(), half a second later
    },
  }
  // every sound starts at its own trim and leaves the level at 1 for the next one
  for (const k of Object.keys(api) as (keyof typeof api)[]) {
    const f = api[k] as (...a: unknown[]) => unknown
    ;(api as Record<string, unknown>)[k] = (...a: unknown[]) => {
      boost = db(TRIM[k] ?? 0)
      try {
        return f(...a)
      } finally {
        boost = 1
      }
    }
  }
  return api
}

export const SFX = createSfx()
