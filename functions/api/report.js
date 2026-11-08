import {ok,now,currentVisitor,throttle,readJson} from '../lib/shared.js';
export async function onRequestPost(ctx){
  if(!ctx.env.DB)return ok({error:'D1 binding missing'},503);
  try{
    const v=await currentVisitor(ctx);if(!v)return ok({error:'Enter email first'},401);
    if(await throttle(ctx,30))return ok({error:'Too many reports'},429);
    const data=await readJson(ctx.request),type=String(data.source_type||'video');
    if(!['video','camera','url'].includes(type))return ok({error:'Invalid video source'},400);
    const counts=['car','motorcycle','bus','truck','bicycle'].map(k=>Number(data[k]||0));
    if(counts.some(n=>!Number.isInteger(n)||n<0||n>100000))return ok({error:'Invalid counts'},400);
    const total=counts.reduce((a,b)=>a+b,0);
    await ctx.env.DB.prepare('INSERT INTO reports(id,email,source_type,total,cars,motorcycles,buses,trucks,bicycles,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),v.email,type,total,...counts,now()).run();
    return ok({saved:true,total});
  }catch(e){return ok({error:'Failed to save report'},500);}
}
