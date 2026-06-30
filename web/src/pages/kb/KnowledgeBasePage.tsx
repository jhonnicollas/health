import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

type Article = {
  id: string
  slug?: string
  category?: string
  title: string
  body: string
  contentMarkdown?: string
}

type ApiResp<T> = { success: boolean; data?: T; error?: { message: string } }

type ArticleSection = {
  heading: string
  paragraphs: string[]
  bullets: string[]
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  all: 'kb.catAll',
  device: 'kb.catDevice',
  metric: 'kb.catMetric',
  safety: 'kb.catSafety'
}

const WORKFLOW_STEP_KEYS = [
  { icon: 'info', labelKey: 'kb.stepPurpose', descKey: 'kb.stepPurposeDesc' },
  { icon: 'settings_input_component', labelKey: 'kb.stepSetup', descKey: 'kb.stepSetupDesc' },
  { icon: 'photo_camera', labelKey: 'kb.stepPhoto', descKey: 'kb.stepPhotoDesc' },
  { icon: 'analytics', labelKey: 'kb.stepRead', descKey: 'kb.stepReadDesc' },
  { icon: 'replay', labelKey: 'kb.stepRetry', descKey: 'kb.stepRetryDesc' },
  { icon: 'contact_phone', labelKey: 'kb.stepContact', descKey: 'kb.stepContactDesc' }
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
  const { t } = useI18n()
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [fullArticle, setFullArticle] = useState<Article | null>(null)

  useEffect(() => {
    fetch('/api/kb', { credentials: 'include' })
      .then((r) => { if (!r.ok) return null; return r.json() as Promise<ApiResp<{ articles: Article[] }>> })
      .then((d) => {
        if (d && d.success && d.data?.articles) {
          setArticles(d.data.articles)
          setSelectedId(d.data.articles[0]?.id ?? null)
        }
      })
  }, [])

  useEffect(() => {
    const selected = articles.find(a => a.id === selectedId)
    if (!selected?.slug) return
    fetch(`/api/kb/${encodeURIComponent(selected.slug)}`, { credentials: 'include' })
      .then(r => { if (!r.ok) return null; return r.json() as Promise<ApiResp<{ article: Article }>> })
      .then(body => { if (body && body.success && body.data?.article) setFullArticle(body.data.article) })
      .catch(() => {})
  }, [selectedId, articles])

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(articles.map(article => article.category ?? 'device')))],
    [articles]
  )
  const visibleArticles = useMemo(
    () => category === 'all' ? articles : articles.filter(article => (article.category ?? 'device') === category),
    [articles, category]
  )
  const selectedArticle = articles.find(article => article.id === selectedId) ?? visibleArticles[0] ?? null
  const displayArticle = fullArticle && selectedArticle && fullArticle.slug === selectedArticle.slug ? { ...selectedArticle, body: fullArticle.body || fullArticle.contentMarkdown || selectedArticle.body } : selectedArticle
  const sections = displayArticle ? parseArticle(displayArticle.body) : []

  return (
    <div className="kb-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('kb.eyebrow')}</p>
          <h2>{t('kb.title')}</h2>
          <p>{t('kb.subtitle')}</p>
        </div>
        <span className="status-chip">{articles.length} {t('kb.guides')}</span>
      </div>

      {articles.length === 0 ? <p>{t('kb.noGuides')}</p> : null}

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
                  {t(CATEGORY_LABEL_KEYS[item] ?? '') || item}
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

          {displayArticle ? (
            <article className="kb-reader" aria-labelledby="kb-reader-title">
              <header className="kb-reader-hero">
                <span className="status-chip">{t(CATEGORY_LABEL_KEYS[displayArticle.category ?? 'device'] ?? '') || displayArticle.category}</span>
                <div className="kb-reader-title-row">
                  <span className="material-symbols-outlined" aria-hidden="true">{articleIcon(displayArticle)}</span>
                  <h3 id="kb-reader-title">{displayArticle.title}</h3>
                </div>
                <p>{articleSummary(displayArticle)}</p>
                <a href="/measurements/new" className="kb-cta-btn">
                  <span className="material-symbols-outlined">add_circle</span>
                  {t('kb.recordWithDevice')}
                </a>
              </header>

              <div className="kb-workflow-stepper">
                {WORKFLOW_STEP_KEYS.map((step, i) => (
                  <div key={step.labelKey} className={`kb-workflow-step ${sections.some(s => matchWorkflowStep(s) === i) ? 'has-content' : ''}`}>
                    <div className="kb-workflow-step-icon">
                      <span className="material-symbols-outlined">{step.icon}</span>
                    </div>
                    <div className="kb-workflow-step-text">
                      <strong>{i + 1}. {t(step.labelKey)}</strong>
                      <small>{t(step.descKey)}</small>
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
                  <strong>{t('kb.needInterpretation')}</strong>
                  <p>{t('kb.consultDoctor')}</p>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </div>
  )}

export default KnowledgeBasePage
