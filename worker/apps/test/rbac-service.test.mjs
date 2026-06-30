import assert from 'node:assert/strict'
import test from 'node:test'
import { RbacService } from '../dist/services/rbac.js'

class RbacStatementMock {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.params = []
  }

  bind(...params) {
    this.params = params
    return this
  }

  activeRoles(userId) {
    return this.db.userRoles
      .filter((row) => row.userId === userId && row.active === 1 && row.revokedAt === null)
      .map((userRole) => this.db.roles.find((role) => role.roleCode === userRole.roleCode && role.active === 1))
      .filter(Boolean)
  }

  permissions(userId) {
    const roleCodes = new Set(this.activeRoles(userId).map((role) => role.roleCode))
    return this.db.rolePermissions
      .filter((row) => roleCodes.has(row.roleCode))
      .map((row) => this.db.permissions.find((permission) => permission.permissionCode === row.permissionCode && permission.active === 1))
      .filter(Boolean)
  }

  async all() {
    const userId = this.params[0]
    if (this.sql.includes('SELECT r.roleCode')) {
      return { results: this.activeRoles(userId).map(({ roleCode, roleName, systemRole }) => ({ roleCode, roleName, systemRole })) }
    }
    return { results: this.permissions(userId).map(({ permissionCode, category }) => ({ permissionCode, category })) }
  }

  async first() {
    const [userId, permissionCode] = this.params
    return this.permissions(userId).some((permission) => permission.permissionCode === permissionCode)
      ? { permissionCode }
      : null
  }
}

class RbacDbMock {
  constructor() {
    this.roles = [
      { roleCode: 'user', roleName: 'User', systemRole: 1, active: 1 },
      { roleCode: 'admin', roleName: 'Admin', systemRole: 1, active: 1 },
      { roleCode: 'support', roleName: 'Support', systemRole: 1, active: 0 },
      { roleCode: 'superAdmin', roleName: 'Super Admin', systemRole: 1, active: 1 }
    ]
    this.permissions = [
      { permissionCode: 'admin.config.read', category: 'admin.config', active: 1 },
      { permissionCode: 'admin.config.update', category: 'admin.config', active: 1 },
      { permissionCode: 'admin.billing.manage', category: 'admin.billing', active: 0 }
    ]
    this.rolePermissions = [
      { roleCode: 'admin', permissionCode: 'admin.config.read' },
      { roleCode: 'admin', permissionCode: 'admin.config.update' },
      { roleCode: 'admin', permissionCode: 'admin.billing.manage' },
      { roleCode: 'superAdmin', permissionCode: 'admin.config.read' }
    ]
    this.userRoles = [
      { userId: 1, roleCode: 'user', active: 1, revokedAt: null },
      { userId: 2, roleCode: 'admin', active: 1, revokedAt: null },
      { userId: 3, roleCode: 'admin', active: 1, revokedAt: '2026-01-01T00:00:00.000Z' },
      { userId: 4, roleCode: 'support', active: 1, revokedAt: null },
      { userId: 5, roleCode: 'superAdmin', active: 1, revokedAt: null }
    ]
  }

  prepare(sql) {
    return new RbacStatementMock(this, sql)
  }
}

test('RbacService supports multi-role active permissions', async () => {
  const db = new RbacDbMock()
  db.userRoles.push({ userId: 1, roleCode: 'admin', active: 1, revokedAt: null })

  assert.deepEqual(await RbacService.getUserRoles(db, 1), [
    { roleCode: 'user', roleName: 'User', systemRole: 1 },
    { roleCode: 'admin', roleName: 'Admin', systemRole: 1 }
  ])
  assert.equal(await RbacService.hasPermission(db, 1, 'admin.config.update'), true)
})

test('RbacService ignores revoked role, inactive role, and inactive permission', async () => {
  const db = new RbacDbMock()

  assert.equal(await RbacService.hasPermission(db, 3, 'admin.config.read'), false)
  assert.deepEqual(await RbacService.getUserRoles(db, 4), [])
  assert.equal(await RbacService.hasPermission(db, 2, 'admin.billing.manage'), false)
})

test('RbacService grants seeded superAdmin permissions through rolePermissions only', async () => {
  const db = new RbacDbMock()

  assert.equal(await RbacService.hasPermission(db, 5, 'admin.config.read'), true)
  assert.equal(await RbacService.hasPermission(db, 5, 'admin.config.update'), false)
})

test('RbacService admin role has Sprint 6 AI permissions seeded', async () => {
  const db = new RbacDbMock()
  // Seed Sprint 6 AI permissions into the mock db as the migration does
  const sprint6Permissions = [
    'admin.aiModelRun.read',
    'admin.aiSafety.read',
    'admin.aiEvaluation.read',
    'admin.aiEvaluation.review',
    'admin.aiConfig.read',
    'admin.aiConfig.update',
    'admin.whatsapp.read'
  ]
  for (const permissionCode of sprint6Permissions) {
    db.permissions.push({ permissionCode, category: 'admin', active: 1 })
    db.rolePermissions.push({ roleCode: 'admin', permissionCode })
  }

  assert.equal(await RbacService.hasPermission(db, 2, 'admin.aiModelRun.read'), true)
  assert.equal(await RbacService.hasPermission(db, 2, 'admin.aiSafety.read'), true)
  assert.equal(await RbacService.hasPermission(db, 2, 'admin.aiEvaluation.review'), true)
})
