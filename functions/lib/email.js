import {escapeHtml} from './shared.js';
const PORTFOLIO='https://kanil-kanchana-dev.janakiswaranamali.chatgpt.site/';
const GITHUB='https://github.com/kanilkanchana';
const LINKEDIN='https://www.linkedin.com/in/kanil-kanchana-4a8441191';
const base64url = s => {
  const bytes=new TextEncoder().encode(s);let b='';
  for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
export function welcomeTemplate(email){return `<!doctype html><html><body style="margin:0;background:#f7f8fc;font-family:Arial,sans-serif;color:#111827"><table width="100%" cellpadding="20" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#121326;color:#fff;padding:30px;border-bottom:4px solid #8754ed"><span style="font-size:25px;font-weight:800">Vehicle<span style="color:#bba3ff">AI</span></span><span style="float:right;font-size:11px;color:#a5a8c5">TRAFFIC INTELLIGENCE</span></td></tr><tr><td style="padding:36px"><h1 style="font-size:24px">Thank you for exploring VehicleAI! 👋</h1><p style="line-height:1.7;color:#475569">Welcome to VehicleAI, a computer vision project for vehicle detection, tracking, and traffic insights. Your uploaded videos are processed locally in your browser and are not retained on our server.</p><p style="background:#f2efff;border-left:4px solid #7c3aed;border-radius:6px;padding:18px;line-height:1.6"><b>What's inside?</b><br>Live camera analysis · Video detection · Vehicle counting · Traffic statistics</p><p style="margin:30px 0"><a href="${PORTFOLIO}" style="background:#6d28d9;color:white;font-weight:bold;text-decoration:none;padding:15px 22px;border-radius:8px">View Portfolio & Projects →</a></p><hr style="border:none;border-top:1px solid #e2e8f0"><b>Kanil Kanchana</b><p style="font-size:13px;color:#64748b">Full-Stack & AI Systems Developer</p><p style="font-size:13px"><a style="color:#6d28d9" href="${PORTFOLIO}">Portfolio</a> · <a style="color:#6d28d9" href="${GITHUB}">GitHub</a> · <a style="color:#6d28d9" href="${LINKEDIN}">LinkedIn</a></p><p style="font-size:11px;color:#94a3b8;margin-top:32px">You received this message because this email (${escapeHtml(email)}) was entered on the VehicleAI website. If it wasn't you, please ignore it.</p></td></tr><tr><td style="padding:18px;text-align:center;background:#f8fafc;font-size:11px;color:#94a3b8">VehicleAI · Computer Vision Portfolio</td></tr></table></td></tr></table></body></html>`}
export async function gmail(env,to,subject,text,html){
  if(!(env.GMAIL_CLIENT_ID&&env.GMAIL_CLIENT_SECRET&&env.GMAIL_REFRESH_TOKEN&&env.SENDER_EMAIL))return {sent:false,reason:'not_configured'};
  if(!/^[^\r\n\s@]+@[^\r\n\s@]+\.[^\r\n\s@]+$/.test(to))throw new Error('Invalid recipient');
  const tokenResult=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'})});
  if(!tokenResult.ok)throw new Error('Google OAuth refresh failed: '+tokenResult.status);
  const {access_token}=await tokenResult.json();if(!access_token)throw new Error('No access token returned');
  const boundary='va-'+crypto.randomUUID();
  const raw=`From: VehicleAI <${env.SENDER_EMAIL}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${text}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${html}\r\n--${boundary}--`;
  const result=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${access_token}`},body:JSON.stringify({raw:base64url(raw)})});
  if(!result.ok)throw new Error('Gmail API send failed: '+result.status);
  return {sent:true};
}
export const welcome = (env,email)=>gmail(env,email,'Thank you for exploring VehicleAI',`Thanks for exploring VehicleAI! Visit my portfolio: ${PORTFOLIO}\nGitHub: ${GITHUB}\nLinkedIn: ${LINKEDIN}\n\nKanil Kanchana`,welcomeTemplate(email));
export const ownerNotice=(env,email)=>env.OWNER_EMAIL?gmail(env,env.OWNER_EMAIL,'VehicleAI: new visitor',`A new visitor provided: ${email}`,`<h3>New VehicleAI visitor</h3><p>${escapeHtml(email)}</p>`):Promise.resolve({sent:false});
