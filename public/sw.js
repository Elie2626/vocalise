// Service worker de Vocalise — gère le Web Share Target (fichiers + liens).

const SHARE_CACHE = "vocalise-share";
const SHARED_FILE_KEY = "/__shared_media";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercepte uniquement le POST de partage vers /app/share.
  if (event.request.method === "POST" && url.pathname === "/app/share") {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sharedUrl = (formData.get("url") || formData.get("text") || "").toString().trim();

    if (file && typeof file !== "string") {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARED_FILE_KEY,
        new Response(file, {
          headers: {
            "content-type": file.type || "application/octet-stream",
            "x-file-name": encodeURIComponent(file.name || "partage"),
          },
        })
      );
      return Response.redirect("/app/share?shared=file", 303);
    }

    if (sharedUrl) {
      return Response.redirect(`/app/share?shared=link&url=${encodeURIComponent(sharedUrl)}`, 303);
    }

    return Response.redirect("/app/share?shared=empty", 303);
  } catch {
    return Response.redirect("/app/share?shared=error", 303);
  }
}
