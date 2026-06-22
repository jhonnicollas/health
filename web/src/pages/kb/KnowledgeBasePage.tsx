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

const WORKFLOW_STEPS = [
  { icon: 'info', label: 'Purpose', description: 'Understand what this device measures' },
  { icon: 'settings_input_component', label: 'Device Setup', description: 'Prepare the device for measurement' },
  { icon: 'photo_camera', label: 'Photo', description: 'Take a clear photo of the reading' },
  { icon: 'analytics', label: 'Read Result', description: 'Verify the extracted values' },
  { icon: 'replay', label: 'Retry', description: 'Retake if the reading is unclear' },
  { icon: 'contact_phone', label: 'Medical Contact', description: 'Consult a doctor for interpretation' }
]

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

function matchWorkflowStep(section: ArticleSection): number {
  const h = section.heading.toLowerCase()
  if (h.includes('cara pakai') || h.includes('cara pengukuran')) return 1
  if (h.includes('tips foto') || h.includes('foto')) return 2
  if (h.includes('arti') || h.includes('kapan') || h.includes('normal')) return 3
  if (h.includes('kesalahan') || h.includes('retry') || h.includes('ulang')) return 4
  return -1
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
          <p>Guided measurement workflows for each device.</p>
        </div>
        <span className="status-chip">{articles.length} guides</span>
      </div>

      {articles.length === 0 ? <p>No guides available yet.</p> : null}

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
                <a href="/measurements/new" className="kb-cta-btn">
                  <span className="material-symbols-outlined">add_circle</span>
                  Record with this device
                </a>
              </header>

              <div className="kb-workflow-stepper">
                {WORKFLOW_STEPS.map((step, i) => (
                  <div key={step.label} className={`kb-workflow-step ${sections.some(s => matchWorkflowStep(s) === i) ? 'has-content' : ''}`}>
                    <div className="kb-workflow-step-icon">
                      <span className="material-symbols-outlined">{step.icon}</span>
                    </div>
                    <div className="kb-workflow-step-text">
                      <strong>{i + 1}. {step.label}</strong>
                      <small>{step.description}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="kb-section-list">
                {sections.map((section) => {
                  const stepIdx = matchWorkflowStep(section)
                  return (
                    <section key={section.heading} className="kb-guide-section">
                      <h4>
                        {stepIdx >= 0 ? (
                          <span className="kb-step-badge">{stepIdx + 1}</span>
                        ) : null}
                        {section.heading}
                      </h4>
                      {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      {section.bullets.length > 0 ? (
                        <ul>
                          {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                        </ul>
                      ) : null}
                    </section>
                  )
                })}
              </div>

              <div className="kb-contact-footer">
                <span className="material-symbols-outlined">contact_phone</span>
                <div>
                  <strong>Need medical interpretation?</strong>
                  <p>Consult your doctor for clinical decisions. This app provides data, not diagnosis.</p>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default KnowledgeBasePage
