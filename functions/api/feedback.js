import {ok,now,currentVisitor,throttle,readJson} from '../lib/shared.js';
export async function onRequestPost(ctx){
  if(!ctx.env.DB)return ok({error:'D1 binding missing'},503);
  try{
    const v=await currentVisitor(ctx);if(!v)return ok({error:'Enter email first'},401);
    const data=await readJson(ctx.request,2048),rating=Number(data.rating),message=String(data.message||'').trim();
    if(!Number.isInteger(rating)||rating<1||rating>5||message.length<5||message.length>1000)return ok({error:'Rating 1–5 and message (5–1000 characters) required'},400);
    if(await throttle(ctx,5))return ok({error:'Feedback submission rate limit reached'},429);
    await ctx.env.DB.prepare('INSERT INTO feedback(id,email,rating,message,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),v.email,rating,message,now()).run();
    return ok({saved:true});
  }catch(e){return ok({error:'Unable to save feedback'},500);}
}
