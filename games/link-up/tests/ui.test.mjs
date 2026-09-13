import test from "node:test";
import assert from "node:assert/strict";

import { todayStr } from "../js/ui.mjs?v=dev";

test("todayStr 使用本地年月日，不受 UTC 日期转换影响", () => {
  const localDate = new Date(2026, 8, 13, 0, 5, 0);
  assert.equal(todayStr(localDate), "2026-09-13");
  const endOfMonth = new Date(2026, 8, 30, 23, 59, 59);
  assert.equal(todayStr(endOfMonth), "2026-09-30");
});
