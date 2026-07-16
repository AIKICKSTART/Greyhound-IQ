import assert from "node:assert/strict";

import { safeAdminPath } from "./admin-operation-path";

assert.equal(safeAdminPath("/admin/users"), "/admin/users");
assert.equal(safeAdminPath("/admin/users?adminResult=forged"), "/admin/users");
assert.equal(safeAdminPath("/administrator"), "/admin");
assert.equal(safeAdminPath("https://evil.example/admin/users"), "/admin/users");
assert.equal(safeAdminPath("//evil.example/admin/users"), "/admin/users");
assert.equal(safeAdminPath(undefined), "/admin");

console.log("admin operation path tests passed");
