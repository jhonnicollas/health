import { useEffect, useState } from 'react'
export function KnowledgeBasePage() {
  const [articles, setArticles] = useState<any[]>([])
  useEffect(() => { fetch('/api/kb', { credentials: 'include' }).then(r => r.json()).then(d => d.success && setArticles(d.data.articles)) }, [])
  return (
    <div className="kb-page">
      <h2>Knowledge Base</h2>
      {articles.map(a => (
        <article key={a.id} className="kb-article">
          <h3>{a.title}</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{a.body}</pre>
        </article>
      ))}
    </div>
  )
}
export default KnowledgeBasePage
