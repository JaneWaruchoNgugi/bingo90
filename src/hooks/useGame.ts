import { useSyncExternalStore } from 'react'
import { game, type Game } from '../game/store'

/** Re-renders the calling component whenever the game state changes. */
export function useGame(): Game {
  useSyncExternalStore(game.subscribe, game.getVersion)
  return game
}
