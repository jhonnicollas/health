import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const srcDir = path.join(root, 'src')
const routesDir = path.join(srcDir, 'routes')
const utilsDir = path.join(srcDir, 'utils')
const indexPath = path.join(srcDir, 'index.ts')
const source = fs.readFileSync(indexPath, 'utf8')

const sourceFile = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

function getFullText(node) {
  return source.substring(node.getFullStart(), node.end)
}

function getPathArg(callExpr) {
  const first = callExpr.arguments[0]
  if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) return first.text
  return null
}

function isRouteCall(stmt) {
  if (!ts.isExpressionStatement(stmt)) return false
  const expr = stmt.expression
  if (!ts.isCallExpression(expr)) return false
  const access = expr.expression
  if (!ts.isPropertyAccessExpression(access)) return false
  if (!ts.isIdentifier(access.expression) || access.expression.text !== 'app') return false
  const method = access.name.text
  if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) return false
  return typeof getPathArg(expr) === 'string'
}

function isAppCreation(stmt) {
  if (!ts.isVariableStatement(stmt)) return false
  for (const decl of stmt.declarationList.declarations) {
    if (ts.isIdentifier(decl.name) && decl.name.text === 'app') return true
  }
  return false
}

function isOnError(stmt) {
  if (!ts.isExpressionStatement(stmt)) return false
  const expr = stmt.expression
  if (!ts.isCallExpression(expr)) return false
  const access = expr.expression
  if (!ts.isPropertyAccessExpression(access)) return false
  return ts.isIdentifier(access.expression) && access.expression.text === 'app' && access.name.text === 'onError'
}

function isExportBlock(stmt) {
  return ts.isExportDeclaration(stmt) && !!stmt.exportClause
}

function isDefaultExport(stmt) {
  return ts.isExportAssignment(stmt) && stmt.isExportEquals === false
}

function groupName(path) {
  if (path === '/') return 'root'
  if (
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/profile') ||
    path.startsWith('/api/me/') ||
    path === '/api/settings/ui' ||
    path === '/api/account/delete' ||
    path === '/api/privacy/deleteAccount'
  ) return 'auth'
  if (path.startsWith('/api/measurements/')) return 'measurements'
  if (path.startsWith('/api/dashboard/')) return 'dashboard'
  if (path.startsWith('/api/reports/') || path === '/api/history/timeline') return 'dashboard'
  if (path.startsWith('/api/ai/')) return 'ai'
  if (path.startsWith('/api/metrics/catalog')) return 'catalog'
  if (path.startsWith('/api/admin/')) return 'admin'
  if (path.startsWith('/api/billing/')) return 'billing'
  if (path.startsWith('/api/family/') || path.startsWith('/api/caregiver/')) return 'family'
  if (path.startsWith('/api/emergency/')) return 'emergency'
  if (path.startsWith('/api/reminders/')) return 'reminders'
  if (path.startsWith('/api/notifications/') || path.startsWith('/api/push/') || path.startsWith('/api/alerts/')) return 'notifications'
  if (path.startsWith('/api/medications') || path.startsWith('/api/medication-logs')) return 'medications'
  if (path.startsWith('/api/patterns/')) return 'patterns'
  if (path === '/api/export/csv') return 'export'
  if (path.startsWith('/api/telegram/')) return 'telegram'
  if (path === '/api/internal/usage/consume') return 'internal'
  if (path === '/api/kb') return 'kb'
  return 'misc'
}

function extractNames(stmt) {
  const names = []
  const typeNames = []
  const add = (n, isType) => isType ? typeNames.push(n) : names.push(n)
  if (ts.isFunctionDeclaration(stmt) && stmt.name) add(stmt.name.text, false)
  if (ts.isInterfaceDeclaration(stmt) && stmt.name) add(stmt.name.text, true)
  if (ts.isTypeAliasDeclaration(stmt) && stmt.name) add(stmt.name.text, true)
  if (ts.isEnumDeclaration(stmt) && stmt.name) add(stmt.name.text, false)
  if (ts.isVariableStatement(stmt)) {
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) add(decl.name.text, false)
    }
  }
  return { names, typeNames }
}

const helpers = []
const groups = new Map()
const groupFirstIndex = new Map()
let routeIndex = 0

for (const stmt of sourceFile.statements) {
  if (ts.isImportDeclaration(stmt)) continue
  if (isAppCreation(stmt)) continue
  if (isOnError(stmt)) continue
  if (isExportBlock(stmt)) continue
  if (isDefaultExport(stmt)) continue

  if (isRouteCall(stmt)) {
    const expr = stmt.expression
    const path = getPathArg(expr)
    const g = groupName(path)
    if (!groups.has(g)) {
      groups.set(g, [])
      groupFirstIndex.set(g, routeIndex)
    }
    groups.get(g).push(stmt)
    routeIndex++
    continue
  }

  helpers.push(stmt)
}

fs.mkdirSync(routesDir, { recursive: true })
fs.mkdirSync(utilsDir, { recursive: true })

const helperNames = []
const helperTypeNames = []
for (const stmt of helpers) {
  const { names, typeNames } = extractNames(stmt)
  helperNames.push(...names)
  helperTypeNames.push(...typeNames)
}
const allHelperExports = [...helperNames, ...helperTypeNames]

const helperImportsBlock = `import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Env, ApiErrorCode } from '../types.js'
import { AuditService } from '../services/audit.js'
import { ConfigService, isSensitiveConfigKey } from '../services/config.js'
import { EntitlementService, QuotaService } from '../services/entitlements.js'
import { EducationService } from '../services/education.js'
import { SymptomService } from '../services/symptom.js'
import { OAuthService } from '../services/oauth.js'
import { RbacService } from '../services/rbac.js'
import { AiMemoryService } from '../services/ai-memory.js'
import { CryptoService } from '../services/crypto.js'
import { EmailOtpService } from '../services/email-otp.js'
import { EmailSenderService } from '../services/email-sender.js'
import { parseLocale } from '../i18n/locale.js'
import { getAiDisclaimer } from '../i18n/disclaimer-templates.js'
import { CheckoutSessionService } from '../services/billing/checkout-session.js'
import { SubscriptionActivationService } from '../services/billing/subscription-activation.js'
import { readBillingConfig } from '../services/billing/config.js'
import { MockBillingProvider } from '../services/billing/providers/mock.js'
import { XenditBillingProvider } from '../services/billing/providers/xendit.js'
import type { BillingProvider } from '../services/billing/provider.js'
import {
  formatIdShortDateTime,
  sendEmergencyToContacts,
  createEmergencyAlert,
  updateDailyStreak,
  awardBadges,
  type ExtraEnv
} from '../routes/extra-helpers.js'
`

const helperBody = helpers.map(h => getFullText(h)).join('')
const exportListParts = []
exportListParts.push(...helperNames)
exportListParts.push(...helperTypeNames.map(t => `type ${t}`))
const helperExports = exportListParts.length ? `\nexport { ${exportListParts.join(', ')} }\n` : '\n'

fs.writeFileSync(path.join(utilsDir, 'helpers.ts'), helperImportsBlock + '\n' + helperBody + helperExports)

const commonRouteImports = `import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Env, ApiErrorCode } from '../types.js'
import { AuditService } from '../services/audit.js'
import { ConfigService, isSensitiveConfigKey } from '../services/config.js'
import { EntitlementService, QuotaService } from '../services/entitlements.js'
import { EducationService } from '../services/education.js'
import { SymptomService } from '../services/symptom.js'
import { OAuthService } from '../services/oauth.js'
import { RbacService } from '../services/rbac.js'
import { AiMemoryService } from '../services/ai-memory.js'
import { CryptoService } from '../services/crypto.js'
import { EmailOtpService } from '../services/email-otp.js'
import { EmailSenderService } from '../services/email-sender.js'
import { parseLocale } from '../i18n/locale.js'
import { getAiDisclaimer } from '../i18n/disclaimer-templates.js'
import { CheckoutSessionService } from '../services/billing/checkout-session.js'
import { SubscriptionActivationService } from '../services/billing/subscription-activation.js'
import { readBillingConfig } from '../services/billing/config.js'
import { MockBillingProvider } from '../services/billing/providers/mock.js'
import { XenditBillingProvider } from '../services/billing/providers/xendit.js'
import type { BillingProvider } from '../services/billing/provider.js'
import {
  formatIdShortDateTime,
  sendEmergencyToContacts,
  createEmergencyAlert,
  updateDailyStreak,
  awardBadges,
  type ExtraEnv
} from './extra-helpers.js'
`

const helperImportParts = []
helperImportParts.push(...helperNames)
helperImportParts.push(...helperTypeNames.map(t => `type ${t}`))
const helperImportLine = helperImportParts.length
  ? `import { ${helperImportParts.join(', ')} } from '../utils/helpers.js'\n`
  : ''

for (const [g, stmts] of groups) {
  const body = stmts.map(s => getFullText(s)).join('')
  const fnName = 'mount' + g[0].toUpperCase() + g.slice(1) + 'Routes'
  const content = `${commonRouteImports}${helperImportLine}
export function ${fnName}(app: Hono<{ Bindings: Env }>) {
${body}}
`
  fs.writeFileSync(path.join(routesDir, `${g}.ts`), content)
}

// Generate index.ts
const sortedGroups = Array.from(groups.keys()).sort((a, b) => groupFirstIndex.get(a) - groupFirstIndex.get(b))
const mountImports = sortedGroups.map(g => {
  const fn = 'mount' + g[0].toUpperCase() + g.slice(1) + 'Routes'
  return `import { ${fn} } from './routes/${g}.js'`
}).join('\n')

const mountCalls = sortedGroups.map(g => {
  const fn = 'mount' + g[0].toUpperCase() + g.slice(1) + 'Routes'
  return `${fn}(app)`
}).join('\n')

const helperImportPartsIndex = []
helperImportPartsIndex.push(...helperNames)
helperImportPartsIndex.push(...helperTypeNames.map(t => `type ${t}`))
const helperImportIndex = helperImportPartsIndex.length
  ? `import { ${helperImportPartsIndex.join(', ')} } from './utils/helpers.js'\nimport { telegramQueueHandler } from './utils/helpers.js'\n`
  : ''

const indexContent = `import { mountAuthRoutes } from "./routes-auth.js"
import { mountHydrationRoutes } from "./routes-hydration.js"
import { mountAiRoutes } from "./routes-ai.js"
import { mountCycleRoutes } from "./routes-cycle.js"
import { mountTelegramRoutes } from "./routes-telegram.js"
import { mountAdminRoutes } from "./routes-admin.js"
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Env, ApiErrorCode } from './types.js'
import {
  mountExtraRoutes,
  scheduledHandler,
  updateDailyStreak,
  awardBadges,
  createEmergencyAlert,
  sendEmergencyToContacts,
  formatIdShortDateTime,
  type ExtraEnv
} from './routes-extra.js'
import { AuditService } from './services/audit.js'
import { ConfigService, isSensitiveConfigKey } from './services/config.js'
import { EntitlementService, QuotaService } from './services/entitlements.js'
import { EducationService } from "./services/education.js"
import { SymptomService } from "./services/symptom.js"
import { OAuthService } from "./services/oauth.js"
import { RbacService } from './services/rbac.js'
import { AiMemoryService } from './services/ai-memory.js'
import { CryptoService } from './services/crypto.js'
import { EmailOtpService } from './services/email-otp.js'
import { EmailSenderService } from './services/email-sender.js'
import { parseLocale } from './i18n/locale.js'
import { getAiDisclaimer } from './i18n/disclaimer-templates.js'
import { CheckoutSessionService } from './services/billing/checkout-session.js'
import { SubscriptionActivationService } from './services/billing/subscription-activation.js'
import { readBillingConfig } from './services/billing/config.js'
import { MockBillingProvider } from './services/billing/providers/mock.js'
import { XenditBillingProvider } from './services/billing/providers/xendit.js'
import type { BillingProvider } from './services/billing/provider.js'
${helperImportIndex}${mountImports}

const app = new Hono<{ Bindings: Env }>()

export type { Env }

app.onError((error, c) => {
  console.error('Unhandled Exception:', error)
  const result = failure('INTERNAL_ERROR', 'Terjadi kesalahan sistem.', 500, [])
  return jsonResponse(c, result)
})

${mountCalls}

mountExtraRoutes(app as any)
mountAuthRoutes(app as any)
mountHydrationRoutes(app as any)
mountAiRoutes(app as any)
mountCycleRoutes(app as any)
mountTelegramRoutes(app as any)
mountAdminRoutes(app as any)

export {
  getCurrentSession,
  jsonResponse,
  success,
  failure,
  app,
  hashPassword,
  normalizeEmail,
  sha256Token,
  validateLoginInput,
  validateOnboardingInput,
  validateProfileUpdateInput,
  validateRegistrationInput,
  validateUiSettingsInput,
  verifyPassword,
  metricCatalogResponse,
  getInsertedId,
  insertAndGetId,
  idsEqual,
  nullableInteger,
  formatIdShortDateTime
}

// US-3.1.3 + US-3.4.2: Worker default export includes fetch, queue, and scheduled handler.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request as any, env as any, ctx as any)
  },
  async queue(batch: MessageBatch<any>, env: Env, _ctx: ExecutionContext): Promise<void> {
    const queueName = (batch as any).queueName || ''
    if (queueName === 'ai-memory-jobs') {
      for (const msg of batch.messages) {
        try {
          const { userId, jobType } = msg.body as { userId: number; jobType: string }
          if (jobType === 'rebuild') {
            const context = await AiMemoryService.buildContextPackage(env.DB, userId)
            await AiMemoryService._executeRebuild(env.DB, userId, context)
          } else if (jobType === 'delete') {
            await AiMemoryService.deleteMemory(env.DB, userId)
          }
          msg.ack()
        } catch {
          msg.retry()
        }
      }
    } else {
      return telegramQueueHandler(batch as MessageBatch<any>, env, _ctx)
    }
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return scheduledHandler(event, env as unknown as ExtraEnv, ctx)
  }
}
`

fs.writeFileSync(indexPath, indexContent)
