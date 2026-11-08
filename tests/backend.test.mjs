import test from 'node:test';import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost,onRequestDelete} from '../functions/api/session.js';
import {onRequestPost as feedback} from '../functions/api/feedback.js';
import {onRequestPost as report} from '../functions/api/report.js';
class FakeDb{
 constructor(){this.visitors=new Map();this.sessions=new Map();this.rate=new Map();this.reports=[];this.feedback=[];}
 prepare(sql){const db=this;return {bind(...args){return {async first(){
  if(sql.startsWith('SELECT email FROM visitor_sessions')){const s=db.sessions.get(args[0]);return s&&s.expires>args[1]?{email:s.email}:null;}
  if(sql.startsWith('SELECT email,welcome_sent_at')){const v=db.visitors.get(args[0]);return v?{email:args[0],welcome_sent_at:v.welcome}:null;}
  if(sql.startsWith('SELECT hits'))return {hits:db.rate.get(args[0])||0};
  return null;},async run(){
  if(sql.startsWith('INSERT INTO rate_limits'))db.rate.set(args[0],(db.rate.get(args[0])||0)+1);
  if(sql.startsWith('INSERT INTO visitors'))db.visitors.set(args[0],{welcome:args[3]});
  if(sql.startsWith('UPDATE visitors SET last_seen')){};
  if(sql.startsWith('UPDATE visitors SET welcome_sent'))db.visitors.get(args[1]).welcome=args[0];
  if(sql.startsWith('INSERT INTO visitor_sessions'))db.sessions.set(args[0],{email:args[1],expires:args[3]});
  if(sql.startsWith('UPDATE visitor_sessions'))db.sessions.get(args[1]).expires=args[0];
  if(sql.startsWith('DELETE FROM visitor_sessions'))db.sessions.delete(args[0]);
  if(sql.startsWith('INSERT INTO feedback'))db.feedback.push(args);
  if(sql.startsWith('INSERT INTO reports'))db.reports.push(args);
  return {success:true};}};}};}
}
const mkctx=(db,method,body,cookie='')=>({env:{DB:db},request:new Request('https://vehicleai-browser.pages.dev/api/session',{method,headers:{...(cookie?{'Cookie':cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})});
test('unconfigured D1 blocks email gate safely',async()=>{const x=await onRequestGet({env:{},request:new Request('https://x.dev/api/session')});assert.equal(x.status,503);});
test('visitor registration, remembered session, logout and feedback',async()=>{
 const db=new FakeDb();const a=await onRequestPost(mkctx(db,'POST',{email:'TEST@example.com',consent:true}));
 assert.equal(a.status,200);const data=await a.json();assert.equal(data.email,'test@example.com');assert.equal(data.mail,'unavailable');
 const cookie=a.headers.get('Set-Cookie')?.split(';')[0];assert.ok(cookie);
 const g=await onRequestGet(mkctx(db,'GET',null,cookie));assert.equal((await g.json()).authenticated,true);
 const fbctx=mkctx(db,'POST',{rating:5,message:'Really good project'},cookie);fbctx.request=new Request('https://vehicleai-browser.pages.dev/api/feedback',{method:'POST',headers:{Cookie:cookie},body:JSON.stringify({rating:5,message:'Really good project'})});
 const fb=await feedback(fbctx);assert.equal(fb.status,200);assert.equal(db.feedback.length,1);
 const rpt=mkctx(db,'POST',null,cookie);rpt.request=new Request('https://vehicleai-browser.pages.dev/api/report',{method:'POST',headers:{Cookie:cookie},body:JSON.stringify({source_type:'video',car:7,truck:2})});
 assert.equal((await report(rpt)).status,200);assert.equal(db.reports[0][3],9);
 await onRequestDelete(mkctx(db,'DELETE',null,cookie));const g2=await onRequestGet(mkctx(db,'GET',null,cookie));assert.equal((await g2.json()).authenticated,false);
});
test('invalid email and missing opt-in are rejected',async()=>{
 const db=new FakeDb();assert.equal((await onRequestPost(mkctx(db,'POST',{email:'nope',consent:true}))).status,400);
 assert.equal((await onRequestPost(mkctx(db,'POST',{email:'valid@example.com',consent:false}))).status,400);
});
