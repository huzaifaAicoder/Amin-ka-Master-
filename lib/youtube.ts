const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/;

export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    let candidate: string | null = null;
    if (host === "youtu.be") candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") candidate = parsed.searchParams.get("v");
      else candidate = parsed.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/)?.[1] ?? null;
    }
    return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
  } catch { return null; }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}?playsinline=1&rel=0&modestbranding=1` : null;
}
