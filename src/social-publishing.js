const API = "https://open.tiktokapis.com";
const encoder = new TextEncoder();

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function fromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}
async function tokenKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
export async function encryptTikTokToken(value, secret) {
  if (!secret || secret.length < 32) throw new Error("NEXUS_SESSION_SECRET fehlt oder ist zu kurz.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(secret), encoder.encode(value));
  return toBase64(iv) + "." + toBase64(encrypted);
}
export async function decryptTikTokToken(value, secret) {
  if (!value) return "";
  if (!secret || secret.length < 32) throw new Error("NEXUS_SESSION_SECRET fehlt oder ist zu kurz.");
  const [iv, cipher] = value.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await tokenKey(secret), fromBase64(cipher));
  return new TextDecoder().decode(plain);
}
async function tiktokRequest(url, accessToken, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data.error && data.error.code && data.error.code !== "ok")) {
    const code = data.error?.code || "http_" + response.status;
    throw new Error("TikTok API: " + code + " — " + (data.error?.message || response.statusText || "Anfrage fehlgeschlagen"));
  }
  return data.data || {};
}
async function refreshAccount(env, row) {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) throw new Error("TikTok-App-Schlüssel fehlen in Cloudflare Secrets.");
  if (!row.refresh_token_encrypted || (row.refresh_expires_at && Date.parse(row.refresh_expires_at) <= Date.now())) {
    throw new Error("TikTok-Verbindung abgelaufen. Bitte Konto erneut verbinden.");
  }
  const refreshToken = await decryptTikTokToken(row.refresh_token_encrypted, env.NEXUS_SESSION_SECRET);
  const form = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const response = await fetch(API + "/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw new Error("TikTok-Token konnte nicht erneuert werden: " + (result.error_description || result.error || response.status));
  const now = Date.now();
  const access = await encryptTikTokToken(result.access_token, env.NEXUS_SESSION_SECRET);
  const refresh = await encryptTikTokToken(result.refresh_token || refreshToken, env.NEXUS_SESSION_SECRET);
  await env.DB.prepare("UPDATE social_accounts SET access_token_encrypted = ?, refresh_token_encrypted = ?, access_expires_at = ?, refresh_expires_at = ?, scope = ?, updated_at = ? WHERE platform = 'tiktok'")
    .bind(access, refresh, new Date(now + Number(result.expires_in || 86400) * 1000).toISOString(),
      new Date(now + Number(result.refresh_expires_in || 31536000) * 1000).toISOString(),
      result.scope || row.scope || "", new Date().toISOString()).run();
  return { ...row, access_token_encrypted: access, refresh_token_encrypted: refresh,
    access_expires_at: new Date(now + Number(result.expires_in || 86400) * 1000).toISOString(),
    refresh_expires_at: new Date(now + Number(result.refresh_expires_in || 31536000) * 1000).toISOString(),
    scope: result.scope || row.scope || "" };
}
export async function getTikTokAccount(env) {
  const row = await env.DB.prepare("SELECT * FROM social_accounts WHERE platform = 'tiktok'").first();
  if (!row) throw new Error("Noch kein TikTok-Konto verbunden.");
  let account = row;
  if (!row.access_expires_at || Date.parse(row.access_expires_at) <= Date.now() + 60000) account = await refreshAccount(env, row);
  const accessToken = await decryptTikTokToken(account.access_token_encrypted, env.NEXUS_SESSION_SECRET);
  return { row: account, accessToken };
}
export async function getTikTokCreatorInfo(env) {
  const { row, accessToken } = await getTikTokAccount(env);
  const info = await tiktokRequest(API + "/v2/post/publish/creator_info/query/", accessToken, {});
  await env.DB.prepare("UPDATE social_accounts SET username = ?, display_name = ?, privacy_options_json = ?, creator_info_json = ?, updated_at = ? WHERE platform = 'tiktok'")
    .bind(info.creator_username || row.username || "", info.creator_nickname || row.display_name || "",
      JSON.stringify(info.privacy_level_options || []), JSON.stringify(info), new Date().toISOString()).run();
  return info;
}
export async function publishTikTokVideo(env, post) {
  if (!env.SOCIAL_MEDIA) throw new Error("R2-Bindung SOCIAL_MEDIA fehlt. Video-Speicher muss bereitgestellt werden.");
  if (!post.video_storage_key) throw new Error("Für diesen Entwurf gibt es noch kein dauerhaft gespeichertes MP4.");
  const { row: account, accessToken } = await getTikTokAccount(env);
  const creator = await tiktokRequest(API + "/v2/post/publish/creator_info/query/", accessToken, {});
  const allowed = creator.privacy_level_options || [];
  const privacy = post.privacy_level || "SELF_ONLY";
  if (!allowed.includes(privacy)) throw new Error("TikTok erlaubt für dieses Konto die gewählte Sichtbarkeit nicht. Bitte Privatsphäre neu auswählen.");
  const object = await env.SOCIAL_MEDIA.get(post.video_storage_key);
  if (!object) throw new Error("Gespeicherte Videodatei wurde in R2 nicht gefunden.");
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > 512 * 1024 * 1024) throw new Error("Videodatei ist leer oder größer als 512 MB.");
  const hashtags = JSON.parse(post.hashtags_json || "[]").map(tag => "#" + String(tag).replace(/^#/, "")).join(" ");
  const title = (String(post.caption || "") + (hashtags ? "\n\n" + hashtags : "")).slice(0, 2200);
  const maxChunk = 64 * 1024 * 1024;
  const count = bytes.byteLength <= maxChunk ? 1 : Math.ceil(bytes.byteLength / maxChunk);
  const chunkSize = count === 1 ? bytes.byteLength : Math.ceil(bytes.byteLength / count);
  const init = await tiktokRequest(API + "/v2/post/publish/video/init/", accessToken, {
    post_info: {
      title,
      privacy_level: privacy,
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
      is_aigc: true
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: bytes.byteLength,
      chunk_size: chunkSize,
      total_chunk_count: count
    }
  });
  if (!init.upload_url || !init.publish_id) throw new Error("TikTok hat keine Upload-ID zurückgegeben.");
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.slice(offset, Math.min(offset + chunkSize, bytes.byteLength));
    const end = offset + chunk.byteLength - 1;
    const upload = await fetch(init.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Range": "bytes " + offset + "-" + end + "/" + bytes.byteLength
      },
      body: chunk
    });
    if (!upload.ok) throw new Error("TikTok-Video-Upload fehlgeschlagen (HTTP " + upload.status + ").");
  }
  const status = await tiktokRequest(API + "/v2/post/publish/status/fetch/", accessToken, { publish_id: init.publish_id });
  const publishStatus = status.status || "PROCESSING_UPLOAD";
  await env.DB.prepare("UPDATE social_posts SET provider_post_id = ?, provider_video_id = ?, publish_status = ?, published_url = ?, published_at = ?, publish_error = NULL, updated_at = ? WHERE id = ?")
    .bind(init.publish_id, status.publicaly_available_post_id || null, publishStatus,
      status.share_url || null, publishStatus === "PUBLISH_COMPLETE" ? new Date().toISOString() : null,
      new Date().toISOString(), post.id).run();
  return { publish_id: init.publish_id, status: publishStatus, video_id: status.publicaly_available_post_id || null, share_url: status.share_url || null, creator: { username: creator.creator_username || account.username || "", nickname: creator.creator_nickname || "" } };
}
export async function fetchTikTokAnalytics(env) {
  const { accessToken } = await getTikTokAccount(env);
  const fields = "id,title,video_description,duration,cover_image_url,embed_link,like_count,comment_count,share_count,view_count,create_time";
  const url = API + "/v2/video/list/?fields=" + encodeURIComponent(fields);
  return tiktokRequest(url, accessToken, { max_count: 20 });
}

export async function fetchTikTokPublishStatus(env, publishId) {
  const { accessToken } = await getTikTokAccount(env);
  return tiktokRequest(API + "/v2/post/publish/status/fetch/", accessToken, { publish_id: publishId });
}
