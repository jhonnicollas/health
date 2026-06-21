import { useEffect, useState } from 'react'

type Article = {
  id: string
  title: string
  body: string
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

export function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    fetch('/api/kb', { credentials: 'include' })
      .then((r) => r.json() as Promise<ApiResp<{ articles: Article[] }>>)
      .then((d) => { if (d.success && d.data?.articles) setArticles(d.data.articles) })
  }, [])

  return (
    <div className="kb-page">
      <h2>Knowledge Base</h2>
      {articles.length === 0 ? <p>Belum ada artikel.</p> : null}
      {articles.map((a) => (
        <article key={a.id} className="kb-article">
          <h3>{a.title}</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{a.body}</pre>
        </article>
      ))}
    </div>
  )
}

export default KnowledgeBasePage
