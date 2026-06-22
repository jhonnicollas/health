import { useEffect, useMemo, useState } from 'react'

type Article = {
  id: string
  slug?: string
  category?: string
  title: string
  body: string
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type ArticleSection = {
  heading: string
  paragraphs: string[]
  bullets: string[]
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  device: 'Devices',
  metric: 'Metrics',
  safety: 'Safety'
}

function articleIcon(article: Article) {
  const haystack = `${article.title} ${article.slug ?? ''}`.toLowerCase()
  if (haystack.includes('omron') || haystack.includes('pressure')) return 'monitor_heart'
  if (haystack.includes('yuwell') || haystack.includes('oximeter')) return 'pulmonology'
  if (haystack.includes('sinocare') || haystack.includes('glucose')) return 'bloodtype'
  if (haystack.includes('thermo') || haystack.includes('suhu')) return 'thermostat'
  if (haystack.includes('scale') || haystack.includes('timbang')) return 'monitor_weight'
  if (haystack.includes('sleep') || haystack.includes('tidur')) return 'bedtime'
  if (haystack.includes('waist') || haystack.includes('lingkar')) return 'straighten'
  if (article.category === 'safety') return 'health_and_safety'
  return 'menu_book'
}

function stripMarkdown(value: string) {
  return value.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
}

function parseArticle(body: string): ArticleSection[] {
  const lines = body.split('\n').map(line => line.trim()).filter(Boolean)
  const sections: ArticleSection[] = []
  let current: ArticleSection = { heading: 'Overview', paragraphs: [], bullets: [] }

  for (const line of lines) {
    if (line.startsWith('# ')) {
      current.heading = stripMarkdown(line)
      continue
    }
    if (line.startsWith('### ')) {
      if (current.paragraphs.length || current.bullets.length) sections.push(current)
      current = { heading: stripMarkdown(line), paragraphs: [], bullets: [] }
      continue
    }
    if (line.startsWith('- ')) {
      current.bullets.push(stripMarkdown(line.slice(2)))
      continue
    }
    current.paragraphs.push(stripMarkdown(line))
  }

  if (current.paragraphs.length || current.bullets.length) sections.push(current)
  return sections
}

function articleSummary(article: Article) {
  const firstBodyLine = article.body
    .split('\n')
    .map(line => stripMarkdown(line))
    .find(line => line && line !== article.title)
  return firstBodyLine ?? 'Panduan ringkas untuk pengukuran, foto alat, dan verifikasi angka.'
}

export function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState('all')

  useEffect(() => {
    fetch('/api/kb', { credentials: 'include' })
      .then((r) => r.json() as Promise<ApiResp<{ articles: Article[] }>>)
      .then((d) => {
        if (d.success && d.data?.articles) {
          setArticles(d.data.articles)
          setSelectedId(d.data.articles[0]?.id ?? null)
        }
      })
  }, [])

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(articles.map(article => article.category ?? 'device')))],
    [articles]
  )
  const visibleArticles = useMemo(
    () => category === 'all' ? articles : articles.filter(article => (article.category ?? 'device') === category),
    [articles, category]
  )
  const selectedArticle = articles.find(article => article.id === selectedId) ?? visibleArticles[0] ?? null
  const sections = selectedArticle ? parseArticle(selectedArticle.body) : []

  return (
    <div className="kb-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Knowledge</p>
          <h2>Knowledge Base</h2>
          <p>Measurement device guides and usage education.</p>
        </div>
        <span className="status-chip">{articles.length} articles</span>
      </div>

      {articles.length === 0 ? <p>No articles yet.</p> : null}

      {articles.length > 0 ? (
        <div className="kb-shell">
          <aside className="kb-directory" aria-label="Knowledge article directory">
            <div className="kb-chips" role="list" aria-label="Article filters">
              {categories.map((item) => (
                <button
                  className={category === item ? 'active' : ''}
                  key={item}
                  onClick={() => setCategory(item)}
                  type="button"
                >
                  {CATEGORY_LABELS[item] ?? item}
                </button>
              ))}
            </div>

            <div className="kb-list">
              {visibleArticles.map((article) => (
                <button
                  className={selectedArticle?.id === article.id ? 'kb-list-card active' : 'kb-list-card'}
                  key={article.id}
                  onClick={() => setSelectedId(article.id)}
                  type="button"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{articleIcon(article)}</span>
                  <span>
                    <strong>{article.title}</strong>
                    <small>{articleSummary(article)}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {selectedArticle ? (
            <article className="kb-reader" aria-labelledby="kb-reader-title">
              <header className="kb-reader-hero">
                <span className="status-chip">{CATEGORY_LABELS[selectedArticle.category ?? 'device'] ?? selectedArticle.category}</span>
                <div className="kb-reader-title-row">
                  <span className="material-symbols-outlined" aria-hidden="true">{articleIcon(selectedArticle)}</span>
                  <h3 id="kb-reader-title">{selectedArticle.title}</h3>
                </div>
                <p>{articleSummary(selectedArticle)}</p>
              </header>

              <div className="kb-media-panel">
                <span className="material-symbols-outlined" aria-hidden="true">image</span>
                <div>
                  <strong>Visual guide ready</strong>
                  <p>Image or video walkthrough can be attached to this article without changing layout.</p>
                </div>
              </div>

              <div className="kb-spec-grid">
                <div>
                  <span>Guide Type</span>
                  <strong>{CATEGORY_LABELS[selectedArticle.category ?? 'device'] ?? selectedArticle.category}</strong>
                </div>
                <div>
                  <span>Use Case</span>
                  <strong>Measure / verify / retake photo</strong>
                </div>
                <div>
                  <span>Safety</span>
                  <strong>Rule-first education</strong>
                </div>
              </div>

              <div className="kb-section-list">
                {sections.map((section) => (
                  <section key={section.heading} className="kb-guide-section">
                    <h4>{section.heading}</h4>
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    {section.bullets.length > 0 ? (
                      <ul>
                        {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default KnowledgeBasePage
