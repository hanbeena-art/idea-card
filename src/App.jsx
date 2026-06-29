import { useEffect, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'idea-card:ideas'
const ACCESS_KEY = 'idea-card:access'
const INVITE_SALT = 'idea-card-local-invite-v1'

const hasStoredAccess = () => {
  if (typeof localStorage === 'undefined') {
    return false
  }

  return (
    localStorage.getItem(ACCESS_KEY) === 'granted' ||
    localStorage.getItem(STORAGE_KEY) !== null
  )
}

const createHash = async (value) => {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const createInviteToken = async () => {
  const seed = `${crypto.randomUUID()}-${Date.now().toString(36)}`
  const signature = await createHash(`${seed}:${INVITE_SALT}`)

  return `${seed}.${signature.slice(0, 18)}`
}

const isValidInviteToken = async (token) => {
  const [seed, signature] = token.split('.')

  if (!seed || !signature) {
    return false
  }

  const expectedSignature = await createHash(`${seed}:${INVITE_SALT}`)

  return expectedSignature.startsWith(signature)
}

const buildInviteUrl = (token) => {
  const inviteUrl = new URL(window.location.href)
  inviteUrl.searchParams.set('invite', token)

  return inviteUrl.toString()
}

const loadStoredIdeas = () => {
  if (typeof localStorage === 'undefined') {
    return []
  }

  try {
    const storedIdeas = localStorage.getItem(STORAGE_KEY)

    if (!storedIdeas) {
      return []
    }

    const parsedIdeas = JSON.parse(storedIdeas)

    if (!Array.isArray(parsedIdeas)) {
      return []
    }

    return parsedIdeas.filter(
      (idea) =>
        typeof idea?.id === 'string' &&
        typeof idea?.content === 'string' &&
        typeof idea?.createdAt === 'string',
    )
  } catch {
    return []
  }
}

function App() {
  const [hasAccess, setHasAccess] = useState(hasStoredAccess)
  const [accessMessage, setAccessMessage] = useState('')
  const [ideas, setIdeas] = useState(loadStoredIdeas)
  const [newIdea, setNewIdea] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    const acceptInvite = async () => {
      const inviteToken = new URLSearchParams(window.location.search).get('invite')

      if (!inviteToken) {
        return
      }

      if (await isValidInviteToken(inviteToken)) {
        localStorage.setItem(ACCESS_KEY, 'granted')
        setHasAccess(true)
        setAccessMessage('초대 링크로 입장했습니다.')
        window.history.replaceState({}, '', window.location.pathname)
        return
      }

      setAccessMessage('초대 링크가 올바르지 않습니다.')
    }

    acceptInvite()
  }, [])

  useEffect(() => {
    if (hasAccess) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas))
    }
  }, [hasAccess, ideas])

  const generateInviteLink = async () => {
    const token = await createInviteToken()

    setInviteLink(buildInviteUrl(token))
    setCopyStatus('')
  }

  const copyInviteLink = async () => {
    if (!inviteLink) {
      return
    }

    await navigator.clipboard.writeText(inviteLink)
    setCopyStatus('복사됐습니다.')
  }

  const addIdea = (event) => {
    event.preventDefault()
    const content = newIdea.trim()

    if (!content) {
      return
    }

    setIdeas((currentIdeas) => [
      {
        id: crypto.randomUUID(),
        content,
        createdAt: new Date().toLocaleString('ko-KR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      ...currentIdeas,
    ])
    setNewIdea('')
  }

  const deleteIdea = (id) => {
    setIdeas((currentIdeas) => currentIdeas.filter((idea) => idea.id !== id))

    if (editingId === id) {
      setEditingId(null)
      setEditingText('')
    }
  }

  const startEditing = (idea) => {
    setEditingId(idea.id)
    setEditingText(idea.content)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingText('')
  }

  const saveEditing = (id) => {
    const content = editingText.trim()

    if (!content) {
      return
    }

    setIdeas((currentIdeas) =>
      currentIdeas.map((idea) =>
        idea.id === id ? { ...idea, content } : idea,
      ),
    )
    cancelEditing()
  }

  if (!hasAccess) {
    return (
      <main className="board-shell">
        <section className="locked-panel" aria-labelledby="locked-title">
          <p className="eyebrow">Private Board</p>
          <h1 id="locked-title">초대가 필요합니다</h1>
          <p>
            이 아이디어 보드는 초대 링크를 받은 사람만 사용할 수 있습니다.
            친구가 보낸 링크로 다시 접속해주세요.
          </p>
          {accessMessage ? <p className="access-message">{accessMessage}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className="board-shell">
      <section className="board-header">
        <div>
          <p className="eyebrow">Idea Board</p>
          <h1>아이디어 보드</h1>
        </div>
        <div className="invite-panel">
          <button type="button" onClick={generateInviteLink}>
            초대 링크 만들기
          </button>
          {inviteLink ? (
            <div className="invite-link-row">
              <input value={inviteLink} readOnly aria-label="초대 링크" />
              <button type="button" onClick={copyInviteLink}>
                복사
              </button>
            </div>
          ) : null}
          {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}
        </div>
      </section>

      <form className="idea-composer" onSubmit={addIdea}>
        <label htmlFor="idea-input">새 아이디어</label>
        <div className="composer-row">
          <textarea
            id="idea-input"
            value={newIdea}
            onChange={(event) => setNewIdea(event.target.value)}
            placeholder="떠오른 내용을 입력하세요"
            rows="3"
          />
          <button type="submit" disabled={!newIdea.trim()}>
            저장
          </button>
        </div>
      </form>

      <section className="idea-list" aria-label="저장된 아이디어">
        {ideas.length === 0 ? (
          <div className="empty-state">
            <h2>아직 저장된 아이디어가 없습니다</h2>
            <p>첫 번째 생각을 남겨보세요.</p>
          </div>
        ) : (
          ideas.map((idea) => {
            const isEditing = editingId === idea.id

            return (
              <article className="idea-card" key={idea.id}>
                <div className="idea-card__meta">
                  <span>{idea.createdAt}</span>
                  <span>#{ideas.findIndex((item) => item.id === idea.id) + 1}</span>
                </div>

                {isEditing ? (
                  <div className="edit-panel">
                    <textarea
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      rows="4"
                      aria-label="아이디어 내용 수정"
                    />
                    <div className="card-actions">
                      <button
                        type="button"
                        onClick={() => saveEditing(idea.id)}
                        disabled={!editingText.trim()}
                      >
                        완료
                      </button>
                      <button type="button" className="ghost" onClick={cancelEditing}>
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="idea-content">{idea.content}</p>
                    <div className="card-actions">
                      <button type="button" onClick={() => startEditing(idea)}>
                        수정
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deleteIdea(idea.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}

export default App
