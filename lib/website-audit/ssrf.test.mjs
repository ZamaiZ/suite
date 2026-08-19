import assert from "node:assert/strict"
import test from "node:test"

import {
  isBlockedHostname,
  isPrivateIp,
  parseHttpUrl,
  resolveRedirectUrl,
} from "./ssrf.ts"

test("isPrivateIp blocks loopback, rfc1918 and link-local", () => {
  assert.equal(isPrivateIp("127.0.0.1"), true)
  assert.equal(isPrivateIp("10.0.0.8"), true)
  assert.equal(isPrivateIp("192.168.1.1"), true)
  assert.equal(isPrivateIp("172.16.0.1"), true)
  assert.equal(isPrivateIp("169.254.1.1"), true)
  assert.equal(isPrivateIp("::1"), true)
  assert.equal(isPrivateIp("8.8.8.8"), false)
})

test("parseHttpUrl rejects non-http and local hosts", () => {
  assert.equal(parseHttpUrl("ftp://exemplo.com.br"), null)
  assert.equal(parseHttpUrl("http://localhost/admin"), null)
  assert.equal(parseHttpUrl("http://127.0.0.1/"), null)
  assert.equal(parseHttpUrl("http://user:pass@exemplo.com.br/"), null)
  assert.ok(parseHttpUrl("https://exemplo.com.br/sobre"))
})

test("resolveRedirectUrl blocks a hop to a private host", () => {
  const current = new URL("https://exemplo.com.br/")
  assert.equal(resolveRedirectUrl(current, "http://127.0.0.1/"), null)
  assert.equal(
    resolveRedirectUrl(current, "/contato")?.toString(),
    "https://exemplo.com.br/contato",
  )
})

test("isBlockedHostname treats .local as blocked", () => {
  assert.equal(isBlockedHostname("printer.local"), true)
  assert.equal(isBlockedHostname("exemplo.com.br"), false)
})
