import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/app.js";

const mockProducts = [
  { id: 1, name: "Trail Backpack", category: "Outdoor", priceCents: 8900, stock: 4 },
  { id: 2, name: "Headlamp", category: "Outdoor", priceCents: 3500, stock: 0 },
];

let upstream;
let bff;
let bffUrl;

const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

before(async () => {
  // Stub of the Java API
  upstream = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/products") return res.end(JSON.stringify(mockProducts));
    const match = req.url.match(/^\/api\/products\/(\d+)$/);
    const found = match && mockProducts.find((p) => p.id === Number(match[1]));
    if (found) return res.end(JSON.stringify(found));
    res.statusCode = 404;
    res.end("{}");
  });
  const upstreamPort = await listen(upstream);
  bff = http.createServer(createApp({ apiBaseUrl: `http://127.0.0.1:${upstreamPort}` }));
  bffUrl = `http://127.0.0.1:${await listen(bff)}`;
});

after(() => {
  upstream.close();
  bff.close();
});

test("health endpoint responds", async () => {
  const res = await fetch(`${bffUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "UP" });
});

test("products are reshaped for the UI", async () => {
  const body = await (await fetch(`${bffUrl}/api/products`)).json();
  assert.equal(body.length, 2);
  assert.equal(body[0].price, "$89.00");
  assert.equal(body[0].availability, "In stock");
  assert.equal(body[1].availability, "Sold out");
});

test("unknown product returns 404", async () => {
  const res = await fetch(`${bffUrl}/api/products/999`);
  assert.equal(res.status, 404);
});

test("returns 502 when the API is down", async () => {
  const dead = http.createServer(createApp({ apiBaseUrl: "http://127.0.0.1:1" }));
  const port = await listen(dead);
  const res = await fetch(`http://127.0.0.1:${port}/api/products`);
  assert.equal(res.status, 502);
  dead.close();
});
