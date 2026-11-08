import {ok,now,sha256,randomToken,sessionCookie,getToken,currentVisitor,throttle,readJson} from '../lib/shared.js';
import {welcome,ownerNotice} from '../lib/email.js';
const DAYS=365;
export async function onRequestGet(ctx){
  if(!ctx.env.DB)return ok({authenticated:false,error:'D1 database binding DB is missing'},503);
  try{
    const v=await currentVisitor(ctx);
    if(!v)return ok({authenticated:false});
    const tok=getToken(ctx.request);
    await ctx.env.DB.prepare('UPDATE visitor_sessions SET expires_at=? WHERE token_hash=?').bind(now()+DAYS*86400,await sha256(tok)).run();
    return ok({authenticated:true,email:v.email},200,{'Set-Cookie':sessionCookie(ctx.request,tok,DAYS)});
  }catch(e){return ok({authenticated:false,error:'D1 schema missing. Run schema.sql.'},503);}
}
export async function onRequestPost(ctx){
  if(!ctx.env.DB)return ok({error:'D1 binding missing'},503);
  try{
    const data=await readJson(ctx.request),email=String(data.email||'').trim().toLowerCase();
    if(!/^[^\s@]{1,64}@[^\s@]{1,200}\.[a-z]{2,}$/i.test(email)||email.length>254)return ok({error:'Enter a valid email address'},400);
    if(data.consent!==true)return ok({error:'Agree to the one-time welcome email before continuing'},400);
    if(await throttle(ctx,6))return ok({error:'Too many requests from this network; try later'},429);
    const stamp=now();
    const old=await ctx.env.DB.prepare('SELECT email,welcome_sent_at FROM visitors WHERE email=?').bind(email).first();
    if(old)await ctx.env.DB.prepare('UPDATE visitors SET last_seen=? WHERE email=?').bind(stamp,email).run();
    else await ctx.env.DB.prepare('INSERT INTO visitors(email,created_at,last_seen,welcome_sent_at) VALUES(?,?,?,NULL)').bind(email,stamp,stamp).run();
    let mail='already_sent';
    if(!old?.welcome_sent_at){
      mail='unavailable';
      try{
        const result=await welcome(ctx.env,email);
        if(result.sent){await ctx.env.DB.prepare('UPDATE visitors SET welcome_sent_at=? WHERE email=?').bind(stamp,email).run();mail='sent';if(!old)try{await ownerNotice(ctx.env,email);}catch(e){console.error('Owner email:',e.message);}}
      }catch(e){console.error('Welcome email:',e.message);mail='failed';}
    }
    const token=randomToken();
    await ctx.env.DB.prepare('INSERT INTO visitor_sessions(token_hash,email,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha256(token),email,stamp,stamp+DAYS*86400).run();
    return ok({authenticated:true,email,mail},200,{'Set-Cookie':sessionCookie(ctx.request,token,DAYS)});
  }catch(e){console.error('Session setup:',e.message);return ok({error:'Database not initialized or service unavailable'},500);}
}
export async function onRequestDelete(ctx){
  const token=getToken(ctx.request);
  if(ctx.env.DB && token)await ctx.env.DB.prepare('DELETE FROM visitor_sessions WHERE token_hash=?').bind(await sha256(token)).run();
  return ok({authenticated:false},200,{'Set-Cookie':sessionCookie(ctx.request,'')});
}
