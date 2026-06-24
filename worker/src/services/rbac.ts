export type RbacRoleRow = {
  roleCode: string
  roleName: string
  systemRole: number
}

export type RbacPermissionRow = {
  permissionCode: string
  category: string
}

export const RbacService = {
  async getUserRoles(db: D1Database, userId: number): Promise<RbacRoleRow[]> {
    const rows = await db.prepare(
      `SELECT r.roleCode, r.roleName, r.systemRole
       FROM HL_userRoles ur
       JOIN HL_roles r ON r.roleCode = ur.roleCode
       WHERE ur.userId = ?
         AND ur.active = 1
         AND ur.revokedAt IS NULL
         AND r.active = 1
       ORDER BY r.roleCode`
    ).bind(userId).all<RbacRoleRow>()
    return rows.results || []
  },

  async getUserPermissions(db: D1Database, userId: number): Promise<string[]> {
    const rows = await db.prepare(
      `SELECT DISTINCT p.permissionCode
       FROM HL_userRoles ur
       JOIN HL_roles r ON r.roleCode = ur.roleCode
       JOIN HL_rolePermissions rp ON rp.roleCode = ur.roleCode
       JOIN HL_permissions p ON p.permissionCode = rp.permissionCode
       WHERE ur.userId = ?
         AND ur.active = 1
         AND ur.revokedAt IS NULL
         AND r.active = 1
         AND p.active = 1
       ORDER BY p.permissionCode`
    ).bind(userId).all<RbacPermissionRow>()
    return (rows.results || []).map((row) => row.permissionCode)
  },

  async hasPermission(db: D1Database, userId: number, permissionCode: string): Promise<boolean> {
    const row = await db.prepare(
      `SELECT p.permissionCode
       FROM HL_userRoles ur
       JOIN HL_roles r ON r.roleCode = ur.roleCode
       JOIN HL_rolePermissions rp ON rp.roleCode = ur.roleCode
       JOIN HL_permissions p ON p.permissionCode = rp.permissionCode
       WHERE ur.userId = ?
         AND ur.active = 1
         AND ur.revokedAt IS NULL
         AND r.active = 1
         AND p.active = 1
         AND p.permissionCode = ?
       LIMIT 1`
    ).bind(userId, permissionCode).first<RbacPermissionRow>()
    return Boolean(row)
  }
}
