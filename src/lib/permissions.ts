export type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "MANAGER" | "SALES_EMPLOYEE" | "PURCHASE_EMPLOYEE" | "INVENTORY_MANAGER" | "EMPLOYEE" | "VIEWER";
const grants: Record<Role, string[]> = {
  OWNER: ["*"], ADMIN: ["customers:read","customers:write","products:read","products:write","invoices:read","invoices:write","expenses:read","expenses:write","reports:read","users:read"],
  ACCOUNTANT: ["customers:read","products:read","invoices:read","invoices:write","expenses:read","expenses:write","payments:read","payments:write","reports:read"],
  MANAGER: ["customers:read","customers:write","products:read","products:write","invoices:read","invoices:write","reports:read","leads:read","leads:write"],
  SALES_EMPLOYEE: ["customers:read","customers:write","invoices:read","invoices:write","leads:read","leads:write"],
  PURCHASE_EMPLOYEE: ["products:read","purchases:read","purchases:write"], INVENTORY_MANAGER: ["products:read","products:write","inventory:read","inventory:write"],
  EMPLOYEE: ["customers:read","products:read"], VIEWER: ["customers:read","products:read","invoices:read","reports:read"]
};
export function hasPermission(role: string, permission: string) {
  const permissions = grants[role as Role] ?? grants.VIEWER;
  return permissions.includes("*") || permissions.includes(permission);
}
