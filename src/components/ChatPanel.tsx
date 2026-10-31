import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, MessageCircle, SendHorizontal, Smile } from 'lucide-react'
import { useGame } from '../hooks/useGame'

/** A steady colour per name, so each player keeps the same avatar colour. */
const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
const EMOJI = ['🎉', '🔥', '🙏', '😅', '💪', '🍀']

/** Room chat. On phones it folds into a round button in the corner that opens it. */
export function ChatPanel() {
  const g = useGame()
  const log = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [emo, setEmo] = useState(false)

  useLayoutEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [g.chatLog[g.chatLog.length - 1]?.id, g.chatOpen])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (v) {
      g.say('You', v)
      setText('')
    }
  }

  return (
    <section className={'panel chatp' + (g.chatOpen ? ' open' : '')} aria-label="Live chat">
      <button className="chd" aria-expanded={g.chatOpen} onClick={() => g.toggleChat()}>
        <span className="cico" aria-hidden="true">
          <MessageCircle />
        </span>
        <span className="ctitle">
          <b>Live Chat</b>
          <small>
            <i className="live" aria-hidden="true" /> {g.players + 44} online
          </small>
        </span>
        <ChevronDown className="cchev" aria-hidden="true" />
      </button>
      <div className="chat" ref={log} aria-live="polite">
        {g.chatLog.map(m => (
          <p key={m.id} className={m.who === 'Host' ? 'chost' : m.who === 'You' ? 'you' : ''}>
            <i className="cav" style={{ '--h': hue(m.who) } as React.CSSProperties} aria-hidden="true">
              {m.who[0]}
            </i>
            <b>{m.who}</b>
            <span>{m.msg}</span>
          </p>
        ))}
      </div>
      <form className="chat-in" onSubmit={submit}>
        <div className="emo">
          <button type="button" className="eb" aria-label="Add an emoji" aria-expanded={emo} onClick={() => setEmo(v => !v)}>
            <Smile aria-hidden="true" />
          </button>
          {emo && (
            <div className="emopop">
              {EMOJI.map(e => (
                <button
                  type="button"
                  key={e}
                  onClick={() => {
                    setText(t => t + e)
                    setEmo(false)
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <input id="chatmsg" value={text} onChange={e => setText(e.target.value)} onFocus={() => !g.chatOpen && g.toggleChat()} placeholder="Type a message…" autoComplete="off" aria-label="Chat message" />
        <button className="send" type="submit" aria-label="Send">
          <SendHorizontal aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
