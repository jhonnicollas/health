// Admin routes extracted from index.ts. Existing dashboard/plans/subscribe routes preserved.
import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import {
  getAuthenticatedUser,
  jsonResponse,
  success,
  failure,
  requireAdminPermission,
  getAdminUserRoles,
  getAdminUserSummary,
  isValidRoleCode,
  isValidPlanCode,
  insertAndGetId,
  isValidSystemConfigKey,
  PROTECTED_SYSTEM_CONFIG_KEYS,
  systemConfigAuditMetadata,
  invalidateSystemConfigCache
} from './utils/index-helpers.js'
import { AuditService } from './services/audit.js'
import { ConfigService } from './services/config.js'
import { RbacService } from './services/rbac.js'

interface LocalEnv { DB: D1Database; TELEGRAM_WATER_WEBHOOK_SECRET?: string; INTERNAL_API_SECRET?: string; LOGS: R2Bucket }
type HC = Context<{ Bindings: LocalEnv }>

function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

function base64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
async function sha256Token(val: string): Promise<string> { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val)); return `sha256:${base64Url(buf)}` }

async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const h = await sha256Token(token)
  const row = await c.env.DB.prepare('SELECT s.userId FROM HL_sessions s JOIN HL_users u ON u.id = s.userId WHERE s.sessionTokenHash = ? AND s.revokedAt IS NULL AND s.expiresAt > datetime("now") AND u.active = 1').bind(h).first<any>()
  return row?.userId || null
}

function getInsertedId(result: D1Result<unknown>): number { const meta = result.meta as any; return Number(meta?.last_row_id ?? 0) }

async function requireAdmin(db: D1Database, uid: number) { if (!await RbacService.hasPermission(db, uid, 'admin.access')) throw new Error('FORBIDDEN') }

export function mountAdminRoutes(app: any) {

  // Admin dashboard summary (unique)
  app.get('/api/admin/dashboard/summary', async (c: HC) => {
    const s = Date.now()
    try {
      const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      await requireAdmin(c.env.DB, uid)
      const [totalUsers, activeSubs, totalSafetyEvents, totalAuditLogs, totalMeasurements] = await Promise.all([
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_users WHERE active = 1').first<any>(),
        c.env.DB.prepare("SELECT COUNT(*) as c FROM HL_subscriptions WHERE status IN ('active','trialing')").first<any>(),
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_safetyEvents').first<any>(),
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_auditLogs').first<any>(),
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_measurementSessions').first<any>()
      ])
      return jr(c, ok({ totalUsers: totalUsers?.c ?? 0, activeSubscriptions: activeSubs?.c ?? 0, totalSafetyEvents: totalSafetyEvents?.c ?? 0, totalAuditLogs: totalAuditLogs?.c ?? 0, totalMeasurements: totalMeasurements?.c ?? 0 }, 200, s), 200)
    } catch (e: any) { if (e.message === 'FORBIDDEN') return jr(c, fail('FORBIDDEN', 'Akses admin diperlukan.', 403, [], s), 403); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  // Public plan listing (unique — no auth)
  app.get('/api/plans', async (c: HC) => {
    const s = Date.now()
    try {
      const rows = await c.env.DB.prepare('SELECT planCode, planName, billingInterval, durationDays, priceAmount, currency, trialDays, description, active, sortOrder FROM HL_plans WHERE active = 1 ORDER BY sortOrder ASC').all<any>()
      const plans = await Promise.all((rows.results || []).map(async (p: any) => {
        const feats = await c.env.DB.prepare('SELECT featureCode, enabled, quotaLimit, quotaWindow FROM HL_planFeatures WHERE planCode = ?').bind(p.planCode).all<any>()
        const fmap: Record<string, any> = {}
        for (const f of (feats.results || [])) fmap[f.featureCode] = { enabled: f.enabled === 1, quotaLimit: f.quotaLimit, quotaWindow: f.quotaWindow }
        return { ...p, features: fmap }
      }))
      return jr(c, ok({ plans }, 200, s), 200)
    } catch (e: any) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  // Deprecated: self-service subscribe — replaced by POST /api/billing/checkout
  app.post('/api/me/subscribe', async (c: HC) => {
    const s = Date.now()
    return jr(c, fail('DEPRECATED', 'Gunakan POST /api/billing/checkout untuk upgrade. Endpoint ini sudah tidak digunakan.', 410, [], s), 410)
  })


app.get('/api/admin/me', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.access', startedAt)
    if (denied) return denied
    const [roles, permissions] = await Promise.all([
      getAdminUserRoles(c.env.DB, user.id),
      RbacService.getUserPermissions(c.env.DB, user.id)
    ])
    return jsonResponse(c, success({
      userId: user.id,
      email: user.email,
      roles,
      permissions,
      canAccessAdmin: true
    }, 200, startedAt))
  } catch (error) {
    console.error('admin me error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat konteks admin.', 500, [], startedAt))
  }
})

app.get('/api/admin/metrics', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.access', startedAt)
    if (denied) return denied
    const [users, plans, subscriptions, safetyEvents, auditLogs] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_users').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_plans').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_subscriptions').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_safetyEvents').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_auditLogs').first<{ c: number }>()
    ])
    return jsonResponse(c, success({
      users: users?.c ?? 0,
      plans: plans?.c ?? 0,
      subscriptions: subscriptions?.c ?? 0,
      safetyEvents: safetyEvents?.c ?? 0,
      auditLogs: auditLogs?.c ?? 0
    }, 200, startedAt))
  } catch (error) {
    console.error('admin metrics error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat metrik dashboard.', 500, [], startedAt))
  }
})

app.get('/api/admin/users', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.users.read', startedAt)
    if (denied) return denied

    const q = (c.req.query('q') || '').trim().toLowerCase()
    const status = c.req.query('status')
    const roleCode = c.req.query('roleCode')
    const planCode = c.req.query('planCode')
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 100)
    const rows = await c.env.DB.prepare(
      `SELECT id, email, displayName, active, createdAt
       FROM HL_users
       ORDER BY createdAt DESC, id DESC
       LIMIT 200`
    ).all<{ id: number; email: string; displayName: string; active: number; createdAt: string }>()

    const enriched = await Promise.all((rows.results || []).map(async (row) => {
      const summary = await getAdminUserSummary(c.env.DB, row.id)
      return {
        userId: row.id,
        email: row.email,
        displayName: row.displayName,
        active: row.active === 1,
        roles: summary.roles,
        subscription: summary.subscription,
        createdAt: row.createdAt
      }
    }))

    const filtered = enriched
      .filter((row) => !q || row.email.toLowerCase().includes(q) || row.displayName.toLowerCase().includes(q))
      .filter((row) => !status || (status === 'active' ? row.active : status === 'disabled' ? !row.active : true))
      .filter((row) => !roleCode || row.roles.includes(roleCode))
      .filter((row) => !planCode || row.subscription.planCode === planCode)
      .slice(0, limit)

    return jsonResponse(c, success(filtered, 200, startedAt))
  } catch (error) {
    console.error('admin users list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat user admin.', 500, [], startedAt))
  }
})

app.get('/api/admin/users/:userId', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const admin = await getAuthenticatedUser(c)
    if (!admin) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, admin, 'admin.users.read', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId') || '')
    if (!Number.isInteger(userId) || userId <= 0) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'userId tidak valid.', 400, [], startedAt))
    }

    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.displayName, u.active, u.createdAt, p.sex, p.birthDate
       FROM HL_users u
       LEFT JOIN HL_userProfiles p ON p.userId = u.id
       WHERE u.id = ?
       LIMIT 1`
    ).bind(userId).first<{ id: number; email: string; displayName: string; active: number; createdAt: string; sex: string | null; birthDate: string | null }>()
    if (!row) return jsonResponse(c, failure('NOT_FOUND', 'User tidak ditemukan.', 404, [], startedAt))
    const summary = await getAdminUserSummary(c.env.DB, userId)
    return jsonResponse(c, success({
      userId: row.id,
      email: row.email,
      displayName: row.displayName,
      active: row.active === 1,
      createdAt: row.createdAt,
      profile: {
        sex: row.sex,
        birthDate: row.birthDate
      },
      roles: summary.roles,
      subscription: summary.subscription,
      supportViewNotice: 'Sensitive health detail is hidden unless admin.sensitiveHealth.read is explicitly granted and audited.'
    }, 200, startedAt))
  } catch (error) {
    console.error('admin user detail error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat detail user.', 500, [], startedAt))
  }
})

app.put('/api/admin/users/:userId/status', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const admin = await getAuthenticatedUser(c)
    if (!admin) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, admin, 'admin.users.update', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId') || '')
    const body = await c.req.json() as { active?: boolean; reason?: string }
    if (!Number.isInteger(userId) || userId <= 0 || typeof body.active !== 'boolean') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Input status user tidak valid.', 400, [], startedAt))
    }
    const existing = await c.env.DB.prepare('SELECT id, active FROM HL_users WHERE id = ? LIMIT 1').bind(userId).first<{ id: number; active: number }>()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'User tidak ditemukan.', 404, [], startedAt))
    await c.env.DB.prepare('UPDATE HL_users SET active = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(body.active ? 1 : 0, userId).run()
    await AuditService.write(c.env.DB, {
      userId: admin.id,
      action: 'admin.users.status.update',
      entityType: 'HL_users',
      entityId: userId,
      metadataJson: { userId, active: body.active, previousActive: existing.active === 1, reason: body.reason }
    })
    return jsonResponse(c, success({ userId, active: body.active, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin user status error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update status user.', 500, [], startedAt))
  }
})


app.get('/api/admin/roles', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare(
      `SELECT r.roleCode, r.roleName, r.description, r.systemRole, r.active, COUNT(rp.permissionCode) AS permissionCount
       FROM HL_roles r
       LEFT JOIN HL_rolePermissions rp ON rp.roleCode = r.roleCode
       GROUP BY r.roleCode, r.roleName, r.description, r.systemRole, r.active
       ORDER BY r.systemRole DESC, r.roleCode`
    ).all<{ roleCode: string; roleName: string; description: string | null; systemRole: number; active: number; permissionCount: number }>()
    return jsonResponse(c, success((rows.results || []).map((row) => ({
      roleCode: row.roleCode,
      roleName: row.roleName,
      description: row.description,
      systemRole: row.systemRole === 1,
      active: row.active === 1,
      permissionCount: row.permissionCount
    })), 200, startedAt))
  } catch (error) {
    console.error('admin roles list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat role.', 500, [], startedAt))
  }
})

app.post('/api/admin/roles', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const body = await c.req.json() as { roleCode?: string; roleName?: string; description?: string }
    const roleCode = (body.roleCode || '').trim()
    const roleName = (body.roleName || '').trim()
    if (!isValidRoleCode(roleCode) || roleName.length < 2) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Role tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      'INSERT INTO HL_roles (roleCode, roleName, description, systemRole, active, createdAt, updatedAt) VALUES (?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).bind(roleCode, roleName, body.description || null).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.roles.create',
      entityType: 'HL_roles',
      entityId: roleCode,
      metadataJson: { roleCode, roleName }
    })
    return jsonResponse(c, success({ roleCode, created: true }, 201, startedAt))
  } catch (error) {
    console.error('admin role create error:', error)
    return jsonResponse(c, failure('VALIDATION_ERROR', 'Role gagal dibuat atau sudah ada.', 400, [], startedAt))
  }
})

app.put('/api/admin/roles/:roleCode/permissions', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const roleCode = c.req.param('roleCode') || ''
    const body = await c.req.json() as { permissionCodes?: string[] }
    const permissionCodes = Array.isArray(body.permissionCodes) ? [...new Set(body.permissionCodes)] : []
    const role = await c.env.DB.prepare('SELECT roleCode, systemRole FROM HL_roles WHERE roleCode = ? LIMIT 1').bind(roleCode).first()
    if (!role) return jsonResponse(c, failure('NOT_FOUND', 'Role tidak ditemukan.', 404, [], startedAt))
    if (permissionCodes.length > 0) {
      const placeholders = permissionCodes.map(() => '?').join(',')
      const rows = await c.env.DB.prepare(`SELECT permissionCode FROM HL_permissions WHERE active = 1 AND permissionCode IN (${placeholders})`).bind(...permissionCodes).all<{ permissionCode: string }>()
      if ((rows.results || []).length !== permissionCodes.length) {
        return jsonResponse(c, failure('VALIDATION_ERROR', 'Permission tidak valid.', 400, [], startedAt))
      }
    }
    await c.env.DB.prepare('DELETE FROM HL_rolePermissions WHERE roleCode = ?').bind(roleCode).run()
    for (const permissionCode of permissionCodes) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)').bind(roleCode, permissionCode).run()
    }
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.roles.permissions.update',
      entityType: 'HL_roles',
      entityId: roleCode,
      metadataJson: { roleCode, permissionCount: permissionCodes.length }
    })
    return jsonResponse(c, success({ roleCode, permissionCount: permissionCodes.length, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin role permissions update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update permission role.', 500, [], startedAt))
  }
})

app.put('/api/admin/roles/:roleCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const roleCode = c.req.param('roleCode') || ''
    const body = await c.req.json() as { roleName?: string; description?: string; active?: boolean }
    const existing = await c.env.DB.prepare('SELECT roleCode, systemRole FROM HL_roles WHERE roleCode = ? LIMIT 1').bind(roleCode).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Role tidak ditemukan.', 404, [], startedAt))
    if (existing.systemRole === 1) return jsonResponse(c, failure('FORBIDDEN', 'System role tidak bisa diubah.', 403, [], startedAt))
    await c.env.DB.prepare(
      'UPDATE HL_roles SET roleName = COALESCE(?, roleName), description = COALESCE(?, description), active = COALESCE(?, active), updatedAt = CURRENT_TIMESTAMP WHERE roleCode = ?'
    ).bind(body.roleName || null, body.description ?? null, typeof body.active === 'boolean' ? (body.active ? 1 : 0) : null, roleCode).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.roles.update',
      entityType: 'HL_roles',
      entityId: roleCode,
      metadataJson: { roleCode, updated: true }
    })
    return jsonResponse(c, success({ roleCode, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin role update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update role.', 500, [], startedAt))
  }
})

app.get('/api/admin/permissions', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare(
      'SELECT permissionCode, permissionName, category, description, active FROM HL_permissions ORDER BY category, permissionCode'
    ).all<{ permissionCode: string; permissionName: string; category: string; description: string | null; active: number }>()
    return jsonResponse(c, success((rows.results || []).map((row) => ({ ...row, active: row.active === 1 })), 200, startedAt))
  } catch (error) {
    console.error('admin permissions list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat permission.', 500, [], startedAt))
  }
})

app.delete('/api/admin/roles/:roleCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const roleCode = c.req.param('roleCode') || ''
    const existing = await c.env.DB.prepare('SELECT roleCode, systemRole FROM HL_roles WHERE roleCode = ? LIMIT 1').bind(roleCode).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Role tidak ditemukan.', 404, [], startedAt))
    if (existing.systemRole === 1) return jsonResponse(c, failure('FORBIDDEN', 'System role tidak bisa dihapus.', 403, [], startedAt))
    await c.env.DB.prepare('DELETE FROM HL_roles WHERE roleCode = ?').bind(roleCode).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.roles.delete', entityType: 'HL_roles', entityId: roleCode, metadataJson: { roleCode, deleted: true } })
    return jsonResponse(c, success({ roleCode, deleted: true }, 200, startedAt))
  } catch (error) {
    console.error('admin role delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal hapus role.', 500, [], startedAt))
  }
})

app.post('/api/admin/users/:userId/roles', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.users.update', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId') || '')
    const body = await c.req.json() as { roleCode?: string }
    const roleCode = (body.roleCode || '').trim()
    if (!Number.isInteger(userId) || userId <= 0 || !isValidRoleCode(roleCode)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Input role user tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      `INSERT INTO HL_userRoles (userId, roleCode, assignedBy, assignedAt, active)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
       ON CONFLICT(userId, roleCode) DO UPDATE SET active = 1, revokedAt = NULL, assignedBy = excluded.assignedBy, assignedAt = CURRENT_TIMESTAMP`
    ).bind(userId, roleCode, user.id).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.users.role.assign',
      entityType: 'HL_userRoles',
      entityId: `${userId}:${roleCode}`,
      metadataJson: { userId, roleCode }
    })
    return jsonResponse(c, success({ userId, roleCode, assigned: true }, 200, startedAt))
  } catch (error) {
    console.error('admin user role assign error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal assign role.', 500, [], startedAt))
  }
})

app.delete('/api/admin/users/:userId/roles/:roleCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.users.update', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId') || '')
    const roleCode = c.req.param('roleCode') || ''
    if (!Number.isInteger(userId) || userId <= 0 || !isValidRoleCode(roleCode)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Input role user tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare('UPDATE HL_userRoles SET active = 0, revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND roleCode = ?').bind(userId, roleCode).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.users.role.revoke',
      entityType: 'HL_userRoles',
      entityId: `${userId}:${roleCode}`,
      metadataJson: { userId, roleCode }
    })
    return jsonResponse(c, success({ userId, roleCode, revoked: true }, 200, startedAt))
  } catch (error) {
    console.error('admin user role revoke error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal revoke role.', 500, [], startedAt))
  }
})



app.get('/api/admin/plans', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.read', startedAt)
    if (denied) return denied
    const includeInactive = c.req.query('includeInactive') === 'true'
    const rows = await c.env.DB.prepare(
      `SELECT p.planCode, p.planName, p.billingInterval, p.durationDays, p.priceAmount, p.currency, p.trialDays, p.description, p.active, p.sortOrder, COUNT(pf.featureCode) AS featureCount
       FROM HL_plans p
       LEFT JOIN HL_planFeatures pf ON pf.planCode = p.planCode
       WHERE (? = 1 OR p.active = 1)
       GROUP BY p.planCode, p.planName, p.billingInterval, p.durationDays, p.priceAmount, p.currency, p.trialDays, p.description, p.active, p.sortOrder
       ORDER BY p.sortOrder, p.planCode`
    ).bind(includeInactive ? 1 : 0).all<any>()
    return jsonResponse(c, success((rows.results || []).map((row) => ({ ...row, active: row.active === 1 })), 200, startedAt))
  } catch (error) {
    console.error('admin plans list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat plan.', 500, [], startedAt))
  }
})

app.post('/api/admin/plans', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const body = await c.req.json() as any
    const planCode = (body.planCode || '').trim()
    if (!isValidPlanCode(planCode) || !body.planName || !['free', 'monthly', 'quarterly', 'yearly', 'manual'].includes(body.billingInterval)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Plan tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      `INSERT INTO HL_plans (planCode, planName, billingInterval, durationDays, priceAmount, currency, trialDays, description, active, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(planCode, body.planName, body.billingInterval, body.durationDays ?? null, body.priceAmount ?? 0, body.currency || 'IDR', body.trialDays ?? 0, body.description || null, body.active === false ? 0 : 1, body.sortOrder ?? 0).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.plans.create', entityType: 'HL_plans', entityId: planCode, metadataJson: { planCode } })
    return jsonResponse(c, success({ planCode, created: true }, 201, startedAt))
  } catch (error) {
    console.error('admin plan create error:', error)
    return jsonResponse(c, failure('VALIDATION_ERROR', 'Plan gagal dibuat atau sudah ada.', 400, [], startedAt))
  }
})

app.put('/api/admin/plans/:planCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const planCode = c.req.param('planCode') || ''
    const body = await c.req.json() as any
    await c.env.DB.prepare(
      `UPDATE HL_plans SET planName = COALESCE(?, planName), durationDays = COALESCE(?, durationDays), priceAmount = COALESCE(?, priceAmount), currency = COALESCE(?, currency), trialDays = COALESCE(?, trialDays), description = COALESCE(?, description), active = COALESCE(?, active), sortOrder = COALESCE(?, sortOrder), updatedAt = CURRENT_TIMESTAMP WHERE planCode = ?`
    ).bind(body.planName ?? null, body.durationDays ?? null, body.priceAmount ?? null, body.currency ?? null, body.trialDays ?? null, body.description ?? null, typeof body.active === 'boolean' ? (body.active ? 1 : 0) : null, body.sortOrder ?? null, planCode).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.plans.update', entityType: 'HL_plans', entityId: planCode, metadataJson: { planCode, updated: true } })
    return jsonResponse(c, success({ planCode, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin plan update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update plan.', 500, [], startedAt))
  }
})

// ponytail: plan soft-delete (sets active=0), no hard delete to preserve FK integrity
app.delete('/api/admin/plans/:planCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const planCode = c.req.param('planCode') || ''
    if (planCode === 'free') return jsonResponse(c, failure('VALIDATION_ERROR', 'Plan free tidak boleh dihapus.', 400, [], startedAt))
    await c.env.DB.prepare('UPDATE HL_plans SET active = 0, updatedAt = CURRENT_TIMESTAMP WHERE planCode = ?').bind(planCode).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.plans.delete', entityType: 'HL_plans', entityId: planCode, metadataJson: { planCode, softDeleted: true } })
    return jsonResponse(c, success({ planCode, deleted: true }, 200, startedAt))
  } catch (error) {
    console.error('admin plan delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menghapus plan.', 500, [], startedAt))
  }
})

app.get('/api/admin/plans/:planCode/features', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.read', startedAt)
    if (denied) return denied
    const planCode = c.req.param('planCode') || ''
    const rows = await c.env.DB.prepare('SELECT featureCode, enabled, quotaLimit, quotaWindow, metadataJson FROM HL_planFeatures WHERE planCode = ? ORDER BY featureCode').bind(planCode).all<any>()
    return jsonResponse(c, success({
      planCode,
      features: (rows.results || []).map((row) => ({ featureCode: row.featureCode, enabled: row.enabled === 1, quotaLimit: row.quotaLimit, quotaWindow: row.quotaWindow, metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null }))
    }, 200, startedAt))
  } catch (error) {
    console.error('admin plan features get error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat fitur plan.', 500, [], startedAt))
  }
})

app.put('/api/admin/plans/:planCode/features', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const planCode = c.req.param('planCode') || ''
    const body = await c.req.json() as { features?: Array<{ featureCode?: string; enabled?: boolean; quotaLimit?: number | null; quotaWindow?: string | null; metadata?: unknown }> }
    const features = Array.isArray(body.features) ? body.features : []
    await c.env.DB.prepare('DELETE FROM HL_planFeatures WHERE planCode = ?').bind(planCode).run()
    for (const feature of features) {
      if (!feature.featureCode) continue
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(planCode, feature.featureCode, feature.enabled === false ? 0 : 1, feature.quotaLimit ?? null, feature.quotaWindow ?? null, feature.metadata ? JSON.stringify(feature.metadata) : null).run()
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.plans.features.update', entityType: 'HL_plans', entityId: planCode, metadataJson: { planCode, featureCount: features.length } })
    return jsonResponse(c, success({ planCode, featureCount: features.length, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin plan features update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update fitur plan.', 500, [], startedAt))
  }
})

app.get('/api/admin/subscriptions', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare(
      `SELECT s.id, s.userId, u.email, s.planCode, s.status, s.provider, s.currentPeriodStart, s.currentPeriodEnd
       FROM HL_subscriptions s
       LEFT JOIN HL_users u ON u.id = s.userId
       ORDER BY s.id DESC LIMIT 100`
    ).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) {
    console.error('admin subscriptions list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat subscription.', 500, [], startedAt))
  }
})

app.post('/api/admin/users/:userId/subscriptions', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId') || '')
    const body = await c.req.json() as any
    const subId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_subscriptions (userId, planCode, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, provider, metadataJson, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, body.planCode, body.status || 'active', body.currentPeriodStart || null, body.currentPeriodEnd || null, body.provider || 'manual', body.metadata ? JSON.stringify(body.metadata) : null))
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.subscriptions.create', entityType: 'HL_subscriptions', entityId: subId, metadataJson: { userId, planCode: body.planCode } })
    return jsonResponse(c, success({ subscriptionId: subId, userId, planCode: body.planCode, status: body.status || 'active' }, 201, startedAt))
  } catch (error) {
    console.error('admin subscription create error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal membuat subscription.', 500, [], startedAt))
  }
})

app.put('/api/admin/subscriptions/:subscriptionId', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const subscriptionId = Number(c.req.param('subscriptionId') || '')
    const body = await c.req.json() as any
    await c.env.DB.prepare(
      `UPDATE HL_subscriptions SET planCode = COALESCE(?, planCode), status = COALESCE(?, status), currentPeriodStart = COALESCE(?, currentPeriodStart), currentPeriodEnd = COALESCE(?, currentPeriodEnd), cancelAtPeriodEnd = COALESCE(?, cancelAtPeriodEnd), metadataJson = COALESCE(?, metadataJson), updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(body.planCode ?? null, body.status ?? null, body.currentPeriodStart ?? null, body.currentPeriodEnd ?? null, typeof body.cancelAtPeriodEnd === 'boolean' ? (body.cancelAtPeriodEnd ? 1 : 0) : null, body.metadata ? JSON.stringify(body.metadata) : null, subscriptionId).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.subscriptions.update', entityType: 'HL_subscriptions', entityId: subscriptionId, metadataJson: { subscriptionId, updated: true } })
    return jsonResponse(c, success({ subscriptionId, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin subscription update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update subscription.', 500, [], startedAt))
  }
})

app.get('/api/admin/configs', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.read', startedAt)
    if (denied) return denied
    const configs = await ConfigService.list(c.env.DB, c.env as unknown as Record<string, unknown>)
    return jsonResponse(c, success({ configs }, 200, startedAt))
  } catch (error) {
    console.error('admin configs list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat konfigurasi.', 500, [], startedAt))
  }
})

app.put('/api/admin/configs/:configKey', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.update', startedAt)
    if (denied) return denied
    const configKey = c.req.param('configKey') || ''
    const body = await c.req.json() as { configValue?: string; configured?: boolean; envVarName?: string; reason?: string }
    if (body.configValue === undefined && body.configured === undefined && body.envVarName === undefined) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configValue wajib.', 400, [], startedAt))
    }
    if (!isValidSystemConfigKey(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey tidak valid.', 400, [], startedAt))
    }
    const updated = await ConfigService.update(c.env.DB, c.env as unknown as Record<string, unknown>, configKey, body)
    invalidateSystemConfigCache(c.env.DB, configKey)
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'configUpdate',
      entityType: 'HL_systemConfigs',
      entityId: configKey,
      metadataJson: systemConfigAuditMetadata(configKey, { updated: true, reason: body.reason })
    })
    return jsonResponse(c, success({ configKey, updated: true, cacheInvalidated: true, secretValueReturned: false, config: updated }, 200, startedAt))
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFIG_NOT_FOUND') {
      return jsonResponse(c, failure('NOT_FOUND', 'Konfigurasi tidak ditemukan.', 404, [], startedAt))
    }
    if (error instanceof Error && error.message === 'INVALID_ENV_VAR_NAME') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'envVarName tidak valid.', 400, [], startedAt))
    }
    console.error('admin config update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update konfigurasi.', 500, [], startedAt))
  }
})

app.post('/api/admin/configs', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.update', startedAt)
    if (denied) return denied
    const body = await c.req.json() as { configKey?: string; configValue?: string; dataType?: string; description?: string }
    const configKey = (body.configKey || '').trim()
    const dataType = (body.dataType || 'string').trim()
    if (!isValidSystemConfigKey(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey tidak valid.', 400, [], startedAt))
    }
    if (!['string', 'number', 'boolean', 'json'].includes(dataType)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'dataType tidak valid.', 400, [], startedAt))
    }
    if (!body.configValue && body.configValue !== '0' && body.configValue !== '') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configValue wajib.', 400, [], startedAt))
    }
    const existing = await c.env.DB.prepare('SELECT configKey FROM HL_systemConfigs WHERE configKey = ?').bind(configKey).first()
    if (existing) return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey sudah ada.', 400, [], startedAt))
    const created = await ConfigService.create(c.env.DB, c.env as unknown as Record<string, unknown>, {
      configKey,
      configValue: body.configValue,
      dataType,
      description: body.description || null
    })
    invalidateSystemConfigCache(c.env.DB, configKey)
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'configCreate',
      entityType: 'HL_systemConfigs',
      entityId: configKey,
      metadataJson: systemConfigAuditMetadata(configKey, { dataType, created: true })
    })
    return jsonResponse(c, success({ created: true, configKey, cacheInvalidated: true, secretValueReturned: false, config: created }, 201, startedAt))
  } catch (error) {
    console.error('admin config create error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal membuat konfigurasi.', 500, [], startedAt))
  }
})

app.delete('/api/admin/configs/:configKey', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.update', startedAt)
    if (denied) return denied
    const configKey = c.req.param('configKey') || ''
    if (!isValidSystemConfigKey(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey tidak valid.', 400, [], startedAt))
    }
    if (PROTECTED_SYSTEM_CONFIG_KEYS.has(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Konfigurasi wajib tidak boleh dihapus.', 400, [], startedAt))
    }
    const existing = await c.env.DB.prepare('SELECT configKey FROM HL_systemConfigs WHERE configKey = ?').bind(configKey).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Konfigurasi tidak ditemukan.', 404, [], startedAt))
    await c.env.DB.prepare('DELETE FROM HL_systemConfigs WHERE configKey = ?').bind(configKey).run()
    invalidateSystemConfigCache(c.env.DB, configKey)
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'configDelete',
      entityType: 'HL_systemConfigs',
      entityId: configKey,
      metadataJson: systemConfigAuditMetadata(configKey, { deleted: true })
    })
    return jsonResponse(c, success({ deleted: true, cacheInvalidated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin config delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menghapus konfigurasi.', 500, [], startedAt))
  }
})


app.get('/api/admin/ai-config', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.aiConfig.read', startedAt)
    if (denied) return denied
    const configs = await ConfigService.list(c.env.DB, c.env as unknown as Record<string, unknown>)
    const allConfigs: Record<string, unknown> = {}
    for (const cfg of configs as any[]) { allConfigs[cfg.configKey] = cfg.isSecret ? { configured: cfg.configValue === '**ENV**' || cfg.configValue === '**SECRET**', masked: true, storageMode: cfg.storageMode || 'd1', envVarName: cfg.envVarName || null } : cfg.configValue }
    const aiConfig = { aiTextEndpoint: allConfigs['aiTextEndpoint'] || 'https://9router.krpmerch.biz.id/v1', aiTextDefaultModel: allConfigs['aiTextDefaultModel'] || 'oc/deepseek-v4-flash-free', aiTextModels: allConfigs['aiTextModels'] ? (typeof allConfigs['aiTextModels'] === 'string' ? JSON.parse(allConfigs['aiTextModels'] as string) : allConfigs['aiTextModels']) : ['oc/deepseek-v4-flash-free','oc/mimo-v2.5-free','fallback/deterministic'], aiTextApiKey: allConfigs['aiTextApiKey'] || { configured: false, masked: true, storageMode: 'env', envVarName: 'AI_TEXT_API_KEY' }, timeoutMs: Number(allConfigs['aiExtractTimeoutMs'] || 10000), maxTokens: 1600, temperature: 0.2, disclaimerTemplate: '[NamaModelAI] is AI and can make mistakes. Always consult a doctor.', vectorizeTopK: 8, aiMemoryEnabled: allConfigs['aiMemoryEnabled'] === 'true' || false, aiClinicalCopilotRuntimeEnabled: false, aiClinicalCopilotScopeStatus: 'deferred_to_sprint6', aiClinicalCopilotAllowedActions: ['prepare_context','store_memory_metadata','query_user_namespace','return_context_trace','enforce_disclaimer','report_readiness_status'], aiClinicalCopilotForbiddenActions: ['final_diagnosis','emergency_decision','prescription','medication_dosage_instruction','replace_doctor_claim','cross_user_retrieval'] }
    return jsonResponse(c, success(aiConfig, 200, startedAt))
  } catch (error) { console.error('admin ai config get error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat AI config.', 500, [], startedAt)) }
})

app.put('/api/admin/ai-config', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.aiConfig.update', startedAt)
    if (denied) return denied
    const body = await c.req.json() as Record<string, unknown>
    const updatedKeys: string[] = []
    const configMap: Record<string, string> = { aiTextEndpoint: 'aiTextEndpoint', aiTextDefaultModel: 'aiTextDefaultModel', aiTextModels: 'aiTextModels', timeoutMs: 'aiExtractTimeoutMs', aiMemoryEnabled: 'aiMemoryEnabled', vectorizeTopK: 'vectorizeTopK', disclaimerTemplate: 'disclaimerTemplate', maxTokens: 'maxTokens', temperature: 'temperature' }
    for (const [key, configKey] of Object.entries(configMap)) {
      if (body[key] !== undefined) { const val = typeof body[key] === 'object' ? JSON.stringify(body[key]) : String(body[key]); await c.env.DB.prepare('UPDATE HL_systemConfigs SET configValue = ?, updatedAt = CURRENT_TIMESTAMP WHERE configKey = ?').bind(val, configKey).run(); updatedKeys.push(key) }
    }
    if (body.apiKeyConfigured === true && body.apiKeyEnvVarName) { await c.env.DB.prepare("UPDATE HL_systemConfigs SET configValue = '**ENV**', updatedAt = CURRENT_TIMESTAMP WHERE configKey = 'aiTextApiKey'").run(); updatedKeys.push('aiTextApiKey') }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.aiConfig.update', entityType: 'HL_systemConfigs', entityId: 'ai', metadataJson: JSON.stringify({ updatedKeys, reason: body.reason || 'AI config update' }) })
    return jsonResponse(c, success({ updatedKeys, secretValueReturned: false }, 200, startedAt))
  } catch (error) { console.error('admin ai config update error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update AI config.', 500, [], startedAt)) }
})

app.get('/api/admin/feature-flags', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare('SELECT flagCode, flagName, description, enabled, targetRoleCode, targetPlanCode, metadataJson FROM HL_featureFlags ORDER BY flagCode').all<any>()
    const flags = (rows.results || []).map((r: any) => ({ flagCode: r.flagCode, flagName: r.flagName, description: r.description, enabled: r.enabled === 1, targetRoleCode: r.targetRoleCode, targetPlanCode: r.targetPlanCode, metadata: r.metadataJson ? JSON.parse(r.metadataJson) : null }))
    return jsonResponse(c, success(flags, 200, startedAt))
  } catch (error) { console.error('admin feature flags list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat feature flags.', 500, [], startedAt)) }
})

app.put('/api/admin/feature-flags/:flagCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.featureFlags.manage', startedAt)
    if (denied) return denied
    const flagCode = c.req.param('flagCode') || ''; const body = await c.req.json() as { flagName?: string; description?: string; enabled?: boolean; targetRoleCode?: string | null; targetPlanCode?: string | null; metadata?: unknown }
    const existing = await c.env.DB.prepare('SELECT id FROM HL_featureFlags WHERE flagCode = ?').bind(flagCode).first<any>()
    if (existing) { await c.env.DB.prepare('UPDATE HL_featureFlags SET flagName = COALESCE(?, flagName), description = COALESCE(?, description), enabled = COALESCE(?, enabled), targetRoleCode = ?, targetPlanCode = ?, metadataJson = COALESCE(?, metadataJson), updatedAt = CURRENT_TIMESTAMP WHERE flagCode = ?').bind(body.flagName || null, body.description || null, body.enabled !== undefined ? (body.enabled ? 1 : 0) : null, body.targetRoleCode || null, body.targetPlanCode || null, body.metadata ? JSON.stringify(body.metadata) : null, flagCode).run() }
    else { await c.env.DB.prepare('INSERT INTO HL_featureFlags (flagCode, flagName, description, enabled, targetRoleCode, targetPlanCode, metadataJson, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(flagCode, body.flagName || flagCode, body.description || null, body.enabled ? 1 : 0, body.targetRoleCode || null, body.targetPlanCode || null, body.metadata ? JSON.stringify(body.metadata) : null).run() }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.featureFlags.update', entityType: 'HL_featureFlags', entityId: flagCode, metadataJson: JSON.stringify({ flagCode, updated: true }) })
    return jsonResponse(c, success({ flagCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin feature flag upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update feature flag.', 500, [], startedAt)) }
})

app.get('/api/admin/education/cards', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.education.manage', startedAt)
    if (denied) return denied
    const { topicType, active, q, limit } = c.req.query()
    let sql = 'SELECT id, topicType, topicCode, title, active, sortOrder, updatedAt FROM HL_educationCards WHERE 1=1'; const params: unknown[] = []
    if (topicType) { sql += ' AND topicType = ?'; params.push(topicType) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (q) { sql += ' AND (title LIKE ? OR topicCode LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
    sql += ' ORDER BY sortOrder ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin education list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat kartu edukasi.', 500, [], startedAt)) }
})

app.put('/api/admin/education/cards/:topicType/:topicCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.education.manage', startedAt)
    if (denied) return denied
    const topicType = c.req.param('topicType') || ''; const topicCode = c.req.param('topicCode') || ''
    const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_educationCards WHERE topicType = ? AND topicCode = ?').bind(topicType, topicCode).first<any>()
    if (existing) {
      const fields = ['title','shortText','whyItMatters','howToUse','normalMeaning','warningMeaning','actionText','redFlagText','sourceLabel','contentMarkdown','minimumPlanCode','active','sortOrder']
      const sets: string[] = []; const vals: unknown[] = []
      for (const f of fields) { if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(f === 'active' ? (body[f] ? 1 : 0) : body[f]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_educationCards SET ${sets.join(', ')} WHERE topicType = ? AND topicCode = ?`).bind(...vals as any[], topicType, topicCode).run() }
    } else {
      await c.env.DB.prepare('INSERT INTO HL_educationCards (topicType, topicCode, title, shortText, whyItMatters, howToUse, normalMeaning, warningMeaning, actionText, redFlagText, sourceLabel, contentMarkdown, active, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(topicType, topicCode, body.title || '', body.shortText || '', body.whyItMatters || '', body.howToUse || '', body.normalMeaning || '', body.warningMeaning || '', body.actionText || '', body.redFlagText || '', body.sourceLabel || 'HL Education', body.contentMarkdown || null, body.active !== false ? 1 : 0, body.sortOrder ?? 0).run()
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.education.upsert', entityType: 'HL_educationCards', entityId: `${topicType}::${topicCode}`, metadataJson: JSON.stringify({ topicType, topicCode, updated: true, inserted: !existing }) })
    return jsonResponse(c, success({ topicType, topicCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin education upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update kartu edukasi.', 500, [], startedAt)) }
})

app.get('/api/admin/audit-logs', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.audit.read', startedAt)
    if (denied) return denied
    const { action, entityType, entityId, userId: qUserId, from, to, limit, cursor } = c.req.query()
    let sql = 'SELECT id, userId, action, entityType, entityId, metadataJson, createdAt FROM HL_auditLogs WHERE 1=1'; const params: unknown[] = []
    if (action) { sql += ' AND action = ?'; params.push(action) }
    if (entityType) { sql += ' AND entityType = ?'; params.push(entityType) }
    if (entityId) { sql += ' AND entityId = ?'; params.push(entityId) }
    if (qUserId) { sql += ' AND userId = ?'; params.push(Number(qUserId)) }
    if (from) { sql += ' AND createdAt >= ?'; params.push(from) }
    if (to) { sql += ' AND createdAt <= ?'; params.push(to) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY id DESC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    const hasMore = (rows.results || []).length === (Number(limit) || 50)
    const logs = (rows.results || []).map((r: any) => ({ id: r.id, userId: r.userId, action: r.action, entityType: r.entityType, entityId: r.entityId, metadata: r.metadataJson ? JSON.parse(r.metadataJson) : null, createdAt: r.createdAt })); return jsonResponse(c, success({ logs, hasMore }, 200, startedAt))
  } catch (error) { console.error('admin audit logs list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat audit logs.', 500, [], startedAt)) }
})

app.get('/api/admin/safety-events', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.security.read', startedAt)
    if (denied) return denied
    const { eventType, severity, userId: qUserId, from, to, limit, cursor } = c.req.query()
    let sql = "SELECT id, userId, sourceType, sourceId, eventType, severity, title, notificationStatus, acknowledged, createdAt FROM HL_safetyEvents WHERE 1=1"; const params: unknown[] = []
    if (eventType) { sql += ' AND eventType = ?'; params.push(eventType) }
    if (severity) { sql += ' AND severity = ?'; params.push(severity) }
    if (qUserId) { sql += ' AND userId = ?'; params.push(Number(qUserId)) }
    if (from) { sql += ' AND createdAt >= ?'; params.push(from) }
    if (to) { sql += ' AND createdAt <= ?'; params.push(to) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY id DESC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin safety events list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat safety events.', 500, [], startedAt)) }
})

app.get('/api/admin/metric-catalog', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricCatalog.manage', startedAt)
    if (denied) return denied
    const { category, active, q, limit, cursor } = c.req.query()
    let sql = 'SELECT metricCode, metricName, category, unit, inputType, physicalMin, physicalMax, active FROM HL_metricCatalog WHERE 1=1'; const params: unknown[] = []
    if (category) { sql += ' AND category = ?'; params.push(category) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (q) { sql += ' AND (metricName LIKE ? OR metricCode LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY sortOrder ASC, metricCode ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin metric catalog list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat metric catalog.', 500, [], startedAt)) }
})

app.put('/api/admin/metric-catalog/:metricCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricCatalog.manage', startedAt)
    if (denied) return denied
    const metricCode = c.req.param('metricCode') || ''; const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_metricCatalog WHERE metricCode = ?').bind(metricCode).first<any>()
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of ['metricName','category','unit','inputType','requiresAttachment','requiresSex','requiresFasting','isCalculated','physicalMin','physicalMax','sortOrder','active']) { if (body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(body[k]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_metricCatalog SET ${sets.join(', ')} WHERE metricCode = ?`).bind(...vals as any[], metricCode).run() }
    } else {
      await c.env.DB.prepare('INSERT INTO HL_metricCatalog (metricCode, metricName, category, unit, inputType, requiresAttachment, requiresSex, requiresFasting, isCalculated, physicalMin, physicalMax, sortOrder, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(metricCode, body.metricName || metricCode, body.category || '', body.unit || '', body.inputType || 'mixed', body.requiresAttachment ? 1 : 0, body.requiresSex ? 1 : 0, body.requiresFasting ? 1 : 0, body.isCalculated ? 1 : 0, body.physicalMin ?? null, body.physicalMax ?? null, body.sortOrder ?? 0).run()
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.metricCatalog.upsert', entityType: 'HL_metricCatalog', entityId: metricCode, metadataJson: JSON.stringify({ metricCode, updated: true, inserted: !existing }) })
    return jsonResponse(c, success({ metricCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin metric catalog upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update metric catalog.', 500, [], startedAt)) }
})

app.get('/api/admin/metric-rules', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricRules.manage', startedAt)
    if (denied) return denied
    const { metricCode, severity, active, limit, cursor } = c.req.query()
    let sql = 'SELECT id, ruleCode, metricCode, sex, ageMin, ageMax, minValue, maxValue, unit, status, severity, emergencyLevel, active FROM HL_metricRules WHERE 1=1'; const params: unknown[] = []
    if (metricCode) { sql += ' AND metricCode = ?'; params.push(metricCode) }
    if (severity) { sql += ' AND severity = ?'; params.push(severity) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY rulePriority ASC, ruleCode ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin metric rules list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat metric rules.', 500, [], startedAt)) }
})

app.put('/api/admin/metric-rules/:ruleCode', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricRules.manage', startedAt)
    if (denied) return denied
    const ruleCode = c.req.param('ruleCode') || ''; const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_metricRules WHERE ruleCode = ?').bind(ruleCode).first<any>()
    const fields = ['metricCode','sex','ageMin','ageMax','minValue','maxValue','unit','status','severity','popupTitle','popupMessage','recommendation','sourceLabel','emergencyLevel','rulePriority','active']
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of fields) { if (body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(body[k]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_metricRules SET ${sets.join(', ')} WHERE ruleCode = ?`).bind(...vals as any[], ruleCode).run() }
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.metricRules.upsert', entityType: 'HL_metricRules', entityId: ruleCode, metadataJson: JSON.stringify({ ruleCode, updated: true }) })
    return jsonResponse(c, success({ ruleCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin metric rules upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update metric rule.', 500, [], startedAt)) }
})

app.get('/api/admin/knowledge-articles', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.kb.manage', startedAt)
    if (denied) return denied
    const { category, active, q, limit, cursor } = c.req.query()
    let sql = 'SELECT slug, title, category, active, updatedAt FROM HL_knowledgeArticles WHERE 1=1'; const params: unknown[] = []
    if (category) { sql += ' AND category = ?'; params.push(category) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (q) { sql += ' AND (title LIKE ? OR slug LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY sortOrder ASC, title ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin knowledge articles list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat knowledge articles.', 500, [], startedAt)) }
})

app.put('/api/admin/knowledge-articles/:slug', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.kb.manage', startedAt)
    if (denied) return denied
    const slug = c.req.param('slug') || ''; const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_knowledgeArticles WHERE slug = ?').bind(slug).first<any>()
    const fields = ['title','category','contentMarkdown','sortOrder','active']
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of fields) { if (body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(body[k]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_knowledgeArticles SET ${sets.join(', ')} WHERE slug = ?`).bind(...vals as any[], slug).run() }
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.kb.upsert', entityType: 'HL_knowledgeArticles', entityId: slug, metadataJson: JSON.stringify({ slug, updated: true }) })
    return jsonResponse(c, success({ slug, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin knowledge article upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update knowledge article.', 500, [], startedAt)) }
})
}
