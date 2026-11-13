/* Static-only resource adapter. No API server, VM or remote execution. */
"use strict";
const CONFIG = __OSOMNI_PAGES_CONFIG__;
const BASE = new URL(CONFIG.base, self.location.origin);
const MANIFEST = new URL(CONFIG.manifest, BASE).href;
const CACHE_NAME = "osomni-pages-manifest-" + CONFIG.revision;
let databasePromise;

async function database() {
  if (!databasePromise) databasePromise = (async () => {
    const cache = await caches.open(CACHE_NAME);
    let response = await cache.match(MANIFEST);
    if (!response) {
      response = await fetch(MANIFEST, {cache: "no-store"});
      if (!response.ok) throw new Error("Cannot load the static resource index");
      const check = await response.clone().json();
      if (check.version !== 1 || check.revision !== CONFIG.revision) throw new Error("Static resource index version mismatch");
      await cache.put(MANIFEST, response.clone());
    }
    const data = await response.json();
    data.folded = new Map(Object.keys(data.routes).map(path => [path.toLowerCase(), path]));
    data.physicalSet = new Set(data.physical);
    return data;
  })();
  try { return await databasePromise; }
  catch (error) { databasePromise = null; throw error; }
}

self.addEventListener("install", event => event.waitUntil(database().then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil((async () => {
  await database();
  // Only our own obsolete index caches; App caches and user data are retained.
  for (const key of await caches.keys()) {
    if (key.startsWith("osomni-pages-manifest-") && key !== CACHE_NAME) await caches.delete(key);
  }
  await self.clients.claim();
})()));

function findRoute(data, path) {
  return Object.hasOwn(data.routes, path) ? path : data.folded.get(path.toLowerCase());
}

function relativePath(url) {
  let path;
  try { path = decodeURIComponent(url.pathname); } catch (_) { return null; }
  if (path.includes("\\") || path.split("/").includes("..")) return null;
  if (path.startsWith(BASE.pathname)) return path.slice(BASE.pathname.length);
  // A few third-party App assets use root-absolute paths. Only existing routes
  // are eligible, and navigations are redirected back into this project's scope.
  if (/^\/(?:public|static)\//.test(path)) return path.slice(1);
  return null;
}

async function resourceResponse(request, data, path) {
  const digest = data.routes[path];
  const meta = data.blobs[digest];
  const [shard, compressed, length] = meta;
  const etag = '"' + digest + '"';
  const headers = new Headers({
    "Content-Type": data.mime[path.split(".").pop().toLowerCase()] || "application/octet-stream",
    "Content-Length": String(length),
    "ETag": etag,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache"
  });
  if (request.headers.get("If-None-Match") === etag) {
    headers.delete("Content-Length");
    return new Response(null, {status: 304, headers});
  }
  let range = request.headers.get("Range") || "";
  if (request.headers.has("If-Range") && request.headers.get("If-Range") !== etag) range = "";
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0, end = length - 1, partial = false;
  if (match && (match[1] || match[2])) {
    start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
    if (start >= length || start > end) {
      headers.set("Content-Range", "bytes */" + length);
      headers.set("Content-Length", "0");
      return new Response(null, {status: 416, headers});
    }
    partial = true;
    headers.set("Content-Range", "bytes " + start + "-" + end + "/" + length);
    headers.set("Content-Length", String(end - start + 1));
  }
  if (request.method === "HEAD") return new Response(null, {status: partial ? 206 : 200, headers});
  const blobURL = new URL(data.shards[shard] + "blobs/" + digest.slice(0, 2) + "/" + digest + ".bin", BASE);
  const response = await fetch(blobURL.href);
  if (!response.ok) throw new Error("Resource unavailable: " + path);
  let body = response.body;
  if (compressed) body = body.pipeThrough(new DecompressionStream("gzip"));
  if (partial) {
    const bytes = await new Response(body).arrayBuffer();
    body = bytes.slice(start, end + 1);
  }
  return new Response(body, {status: partial ? 206 : 200, headers});
}

async function handleRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== BASE.origin || !["GET", "HEAD"].includes(request.method)) return fetch(request);
  let relative = relativePath(url);
  if (relative === null) return fetch(request);
  const data = await database();
  let route = findRoute(data, relative);
  if (!route) {
    const directory = relative.replace(/\/+$/, "");
    const index = (directory ? directory + "/" : "") + "index.html";
    const indexRoute = findRoute(data, index);
    if (indexRoute) {
      if (!url.pathname.endsWith("/")) {
        return Response.redirect(new URL((directory ? directory + "/" : "") + url.search, BASE).href, 301);
      }
      route = indexRoute;
    }
  }
  if (!route) return fetch(request);
  if (request.mode === "navigate" && !url.pathname.startsWith(BASE.pathname)) {
    return Response.redirect(new URL(route + url.search, BASE).href, 302);
  }
  if (data.physicalSet.has(route)) return fetch(request);
  return resourceResponse(request, data, route);
}

self.addEventListener("message", event => {
  if (!event.data || event.data.type !== "OSOMNI_ROUTE_CHECK" || !event.ports[0]) return;
  event.waitUntil((async () => {
    const data = await database();
    const url = new URL(event.data.url);
    const path = url.origin === BASE.origin ? relativePath(url) : null;
    const directory = path === null ? "" : path.replace(/\/+$/, "");
    const found = path !== null && Boolean(findRoute(data, path) || findRoute(data, (directory ? directory + "/" : "") + "index.html"));
    event.ports[0].postMessage({found});
  })());
});

self.addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request).catch(error => {
    console.error("OS-Omni static resources:", error);
    return new Response("This resource is temporarily unavailable. Please reload the page.", {
      status: 503, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}
    });
  }));
});
