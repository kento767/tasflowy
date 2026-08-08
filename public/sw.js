// PWAインストール用の最小限のService Worker。
// キャッシュによる古い画面の固定化を避けるため、fetchはネットワークに委ねる。
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});
