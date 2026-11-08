export const ok = (object, status=200, extra={}) => new Response(JSON.stringify(object), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export const now = () => Math.floor(Date.now()/1000);
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function sha256(s) {
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export const randomToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function sessionCookie(request,token,days=365){
  const isSecure = new URL(request.url).protocol==='https:' ? '; Secure':'';
  return `vehicleai_session=${encodeURIComponent(token)}; Path=/; Max-Age=${token?days*86400:0}; HttpOnly; SameSite=Lax${isSecure}`;
}
export function getToken(req){const m=req.headers.get('cookie')?.match(/(?:^|;\s*)vehicleai_session=([^;]+)/);return m?decodeURIComponent(m[1]):null;}
export async function currentVisitor(ctx){
  if (!ctx.env.DB) return null;
  const token=getToken(ctx.request);if(!token||!/^[a-f0-9]{64}$/.test(token)) return null;
  return await ctx.env.DB.prepare('SELECT email FROM visitor_sessions WHERE token_hash=? AND expires_at>?').bind(await sha256(token),now()).first();
}
export async function throttle(ctx,max=6){
  const ip=ctx.request.headers.get('CF-Connecting-IP')||'localhost';
  const t=now(),hour=Math.floor(t/3600);
  const key=await sha256(`${ip}|${hour}|${new URL(ctx.request.url).pathname}`);
  await ctx.env.DB.prepare('INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1').bind(key,(hour+2)*3600).run();
  const row=await ctx.env.DB.prepare('SELECT hits FROM rate_limits WHERE bucket=?').bind(key).first();
  return (row?.hits??0)>max;
}
export async function readJson(request,max=4096){
  const raw=await request.text();if(raw.length>max)throw new Error('JSON too large');return JSON.parse(raw);
}
