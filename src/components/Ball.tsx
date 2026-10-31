import { colorOf } from '../game/constants'

/** A glossy neon ball with its number on a white disc. */
export function Ball({ n, big }: { n: number; big?: boolean }) {
  return (
    <i className={'ball' + (big ? ' big' : '')} style={{ '--c': colorOf(n) } as React.CSSProperties}>
      <b>{n}</b>
    </i>
  )
}
