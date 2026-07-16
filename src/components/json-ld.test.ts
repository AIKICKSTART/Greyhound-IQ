import assert from "node:assert/strict";

import { serializeJsonLd } from "./json-ld";

const serialized = serializeJsonLd({ value: "</script><script>alert(1)</script>" });

assert.equal(serialized.includes("</script>"), false);
assert.equal(serialized.includes("\\u003c/script>"), true);

console.log("json-ld tests passed");
