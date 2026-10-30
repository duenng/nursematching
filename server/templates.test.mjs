import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_LABELS, TEMPLATE_CATALOG, emailHtml } from "./templates.mjs";

const message = {
  subject: "上門護理報價 – Case CK-1001",
  template_id: "T1",
  case_id: "CK-1001",
  body: "你好，陳先生／女士。\n服務：2026-11-10 10:00–14:00\n總額：HK$1220\n\n工具及物料由客人自備。",
  links: [
    { label: "accept_single", url: "https://care.example/a/token?x=1&y=2" },
  ],
};

test("branded email preserves content, action URLs and confirmation guidance", () => {
  const html = emailHtml(message);
  assert.match(html, /<!doctype html>/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /#750f6d/);
  assert.match(html, /#4e154f/);
  assert.match(html, /#f4c8b6/);
  assert.match(html, /HK\$1220/);
  assert.match(html, /2026-11-10 10:00–14:00/);
  assert.match(html, /工具及物料由客人自備。/);
  assert.match(html, /href="https:\/\/care.example\/a\/token\?x=1&amp;y=2"/);
  assert.ok(html.includes(ACTION_LABELS.accept_single));
  assert.match(html, /直接開啟電郵連結不會更改個案/);
});

test("email escapes untrusted content and excludes non-web action URLs", () => {
  const html = emailHtml({
    ...message,
    subject: '<img src=x onerror="alert(1)">',
    case_id: "<case>",
    body: "<script>alert('body')</script>\n備註：<b>hello</b>",
    links: [
      { label: "bad", url: "javascript:alert(1)" },
      { label: "<img src=x>", url: 'https://care.example/a/" onclick="bad' },
    ],
  });
  assert.doesNotMatch(html, /<script|<img|href="javascript:|" onclick="/);
  assert.match(html, /&lt;case&gt;/);
  assert.match(html, /&lt;b&gt;hello&lt;\/b&gt;/);
  assert.match(html, /&quot; onclick=&quot;bad/);
});

test("every catalog template and messages without actions render without a false next step", () => {
  for (const template_id of Object.keys(TEMPLATE_CATALOG)) {
    const html = emailHtml({ ...message, template_id, links: [] });
    assert.match(html, /CareKnock/);
    assert.match(html, /工具及物料由客人自備。/);
    assert.doesNotMatch(html, /<a |直接開啟電郵連結/);
  }
  assert.doesNotThrow(() => emailHtml({ subject: "更新", body: "你好。" }));
});
