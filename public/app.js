import {CrossingTracker,normalizeBoxes,TYPES,csvFromEvents} from './tracker.mjs?v=12';
const $=id=>document.getElementById(id);
const tracker=new CrossingTracker(.55);
let model=null,loadPromise=null,videoUrl=null,stream=null,sourceType=null;
let liveRequestId=0,loopActive=false,scanActive=false,scanCancel=false,aiBusy=false,previousVideoTime=-1,lastSampleAt=0,lastAnalyzedVideoTime=-1;
let scanSource=null,objectExpiryTimer=null,sessionEmail=null,inferenceTimes=[],selectedTrackId=null,processedFrames=0;
const video=$('player'),preview=$('aiCanvas'),ctx=preview.getContext('2d');
const lineCanvas=$('lineCanvas'),lineCtx=lineCanvas.getContext('2d');
const colors={car:'#24d6d7',van:'#ffd079',motorcycle:'#b88cfa',bus:'#7cdb8d',truck:'#f6b65b',bicycle:'#7596ff'};
const text=(id,value)=>$(id).textContent=value;
const phaseNames={idle:'WAITING FOR SOURCE',ready:'SOURCE READY',loading:'LOADING YOLO MODEL',live:'LIVE FRAME ANALYSIS',scanning:'SEQUENTIAL FRAME SCAN',paused:'PAUSED',complete:'SCAN COMPLETE',stopped:'SCAN STOPPED',error:'CHECK REQUIRED',blocked:'UNSUPPORTED VIDEO LINK'};
const titles={idle:'Ready to analyze traffic',ready:'Video loaded — ready to analyze',loading:'Preparing real AI detection…',live:'Analyzing live video frames',scanning:'Scanning real video frames',paused:'AI analysis paused',complete:'Video analysis complete',stopped:'Timeline scan stopped',error:'Analysis needs attention',blocked:'Please upload a local video'};
function setAnalysisState(state){
 const phase=phaseNames[state]||phaseNames.idle;
 $('analysisMonitor').dataset.state=state;
 document.body.dataset.analysis=state;
 text('analysisPhase',phase);
 text('analysisHeading',titles[state]||titles.idle);
}
function setFrameFacts(at,visible){
 processedFrames++;
 text('analysisFrameCount',String(processedFrames));
 text('analysisFrameTime',new Date(Math.max(0,at)*1000).toISOString().slice(14,19));
 text('analysisFrameVehicles',String(visible));
 if(!scanActive){
  const duration=video.duration;
  if(sourceType==='camera'||!Number.isFinite(duration)||duration<=0){text('progressPercent','LIVE');$('progressFill').style.width='100%';}
  else{const pct=Math.min(100,Math.round(at/duration*100));text('progressPercent',pct+'%');$('progressFill').style.width=pct+'%';}
 }
}
function resetAnalysisFacts(){
 processedFrames=0;text('analysisFrameCount','0');text('analysisFrameTime','00:00');text('analysisFrameVehicles','0');
 text('progressPercent','0%');$('progressFill').style.width='0%';
}
function notice(message,kind='info',state=null){
 text('processingText',message);
 if(state||kind==='error')setAnalysisState(state||(kind==='error'?'error':'idle'));
 console[kind==='error'?'error':'log'](message);
}
async function api(path,options={}){
 const response=await fetch('/api/'+path,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
 let result;try{result=await response.json()}catch{result={error:'API endpoint unavailable; deploy Cloudflare Pages Functions first.'}};
 if(!response.ok)throw new Error(result.error||`API error ${response.status}`);
 return result;
}
function setGate(open){$('gate').hidden=!open;document.body.style.overflow=open?'hidden':'';}
async function sessionStart(){
 try{
  const data=await api('session');
  if(data.authenticated){sessionEmail=data.email;text('userEmail',data.email);$('logoutBtn').hidden=false;setGate(false);}
  else{setGate(true);}
 }catch(e){setGate(true);text('gateStatus',`Setup required: ${e.message}`);}
}
$('gateForm').addEventListener('submit',async(e)=>{
 e.preventDefault();const btn=$('gateBtn');btn.disabled=true;text('gateStatus','Checking your email entry...');
 try{
  const data=await api('session',{method:'POST',body:JSON.stringify({email:$('gateEmail').value,consent:$('gateConsent').checked})});
  sessionEmail=data.email;text('userEmail',data.email);$('logoutBtn').hidden=false;setGate(false);
  notice(data.mail==='sent'?'Welcome email sent. Model will load when you start detection.':data.mail==='already_sent'?'Welcome back! Your browser is remembered.':'Access enabled. The welcome email is not yet configured or could not be sent.');
 }catch(error){text('gateStatus',error.message);}finally{btn.disabled=false;}
});
$('logoutBtn').addEventListener('click',async()=>{
 try{await api('session',{method:'DELETE'});}catch{};
 stopCurrentSource();sessionEmail=null;setGate(true);$('logoutBtn').hidden=true;text('gateStatus','Enter an email address to access the workspace.');
});
function theme(value){document.documentElement.dataset.theme=value;localStorage.setItem('vehicleai-theme',value);$('themeBtn').textContent=value==='dark'?'☀':'☾';}
theme(localStorage.getItem('vehicleai-theme')==='light'?'light':'dark');
$('themeBtn').onclick=()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark');
for(const btn of document.querySelectorAll('[data-tab]'))btn.addEventListener('click',()=>{
 const choice=btn.dataset.tab;
 document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===choice));
 for(const t of ['upload','camera','url'])$(t+'Form').hidden=t!==choice;
});
function clearOldUrl(){if(videoUrl){URL.revokeObjectURL(videoUrl);videoUrl=null;}if(objectExpiryTimer){clearTimeout(objectExpiryTimer);objectExpiryTimer=null;}}
function clearMedia(){
 stopLoop();scanCancel=true;scanActive=false;
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
 video.pause();video.removeAttribute('src');video.srcObject=null;video.load();clearOldUrl();
 $('cameraStopBtn').hidden=true;$('cameraBtn').hidden=false;$('videoEmpty').hidden=false;
 $('scanBtn').disabled=true;sourceType=null;scanSource=null;closeCorrection();resetAnalysisFacts();setAnalysisState('idle');$('playbackSpeed').disabled=false;lastAnalyzedVideoTime=-1;
}
function stopCurrentSource(){clearMedia();tracker.reset();redrawStats();clearPreview();text('sourceLabel','No source');text('modelStatus',model?'● Model ready':'● Model not loaded');}
function applyPlaybackSpeed(){
 const camera=sourceType==='camera';
 $('playbackSpeed').disabled=camera;
 const rate=camera?1:Number($('playbackSpeed').value);
 if(Number.isFinite(rate)&&rate>=0.25&&rate<=1)video.playbackRate=rate;
}
function setSource(type,label){sourceType=type;scanSource=type;tracker.reset();previousVideoTime=-1;lastAnalyzedVideoTime=-1;redrawStats();clearPreview();
 text('sourceLabel',label);$('videoEmpty').hidden=true;closeCorrection();resetAnalysisFacts();
 $('scanBtn').disabled=type==='camera';applyPlaybackSpeed();
 notice(type==='camera'?'Camera ready. Detection starts with live camera frames.':`Source loaded. Video playback set to ${video.playbackRate}×. Press Play or use Sequential analyze for a more detailed timeline scan.`,'info','ready');
}
function expiredObjectUrl(){
 if(sourceType==='upload'){
  clearMedia();notice('The local video reference was released after 30 minutes. Select the file again to continue.','info');
 }
}
$('videoFile').onchange=async(e)=>{
 const file=e.target.files?.[0];if(!file)return;
 clearMedia();videoUrl=URL.createObjectURL(file);video.controls=true;video.muted=false;video.src=videoUrl;video.removeAttribute('crossorigin');video.load();
 setSource('upload',file.name);objectExpiryTimer=setTimeout(expiredObjectUrl,30*60*1000);
};
$('cameraBtn').addEventListener('click',async()=>{
 clearMedia();try{
  stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;video.muted=true;video.controls=false;
  setSource('camera','Live browser camera');
  $('cameraBtn').hidden=true;$('cameraStopBtn').hidden=false;
  await video.play();
 }catch(e){notice('Camera access failed: '+e.message,'error');}
});
$('cameraStopBtn').onclick=()=>{stopCurrentSource();video.controls=true;};
function youtubeId(raw){
 try{const u=new URL(raw);return ['youtube.com','www.youtube.com','youtu.be','m.youtube.com','www.youtube-nocookie.com','music.youtube.com'].includes(u.hostname)?true:null;}catch{return null;}
}
$('switchToUploadBtn').onclick=()=>document.querySelector('[data-tab="upload"]').click();
$('videoUrl').addEventListener('input',()=>{$('videoLinkWarning').hidden=true;});
$('urlBtn').addEventListener('click',()=>{
 const url=$('videoUrl').value.trim();$('videoLinkWarning').hidden=true;
 if(youtubeId(url)){
  stopCurrentSource();$('videoLinkWarning').hidden=false;
  notice('YouTube watch links cannot supply video frames for browser AI. Please upload a local MP4/WebM file you own or can use.','info','blocked');return;
 }
 try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))throw new Error('HTTPS URL required');
  if(u.protocol==='http:' && location.protocol==='https:')throw new Error('HTTPS website requires HTTPS video source');
  clearMedia();video.controls=true;video.muted=false;video.crossOrigin='anonymous';video.src=u.href;video.load();setSource('url','Direct video link');
 }catch(e){notice('Invalid video URL: '+e.message,'error');}
});
video.addEventListener('error',()=>{if(sourceType)notice('Video failed to load. Check codec or remote server CORS headers.','error');});
video.addEventListener('loadedmetadata',()=>{drawLine();updatePosition();if(sourceType)applyPlaybackSpeed();});
video.addEventListener('timeupdate',updatePosition);
function updatePosition(){const t=video.currentTime||0;text('videoPosition',new Date(t*1000).toISOString().substring(14,19));}
$('lineSlider').addEventListener('input',e=>{
 const fraction=Number(e.target.value)/100;tracker.setLine(fraction);closeCorrection();text('lineValue',e.target.value+'%');redrawStats();drawLine();clearPreview();notice('Counting line moved. Counts reset to avoid combining two line positions.');
});
$('confidence').addEventListener('input',e=>text('confidenceValue',e.target.value+'%'));
$('playbackSpeed').addEventListener('change',()=>{
 if(sourceType==='camera')return;
 applyPlaybackSpeed();
 if(sourceType)notice(`Playback speed: ${video.playbackRate}×. Slower playback can let AI inspect more frames, depending on device performance.`,'info',video.paused?'ready':'live');
});
function drawLine(){
 const width=lineCanvas.clientWidth,height=lineCanvas.clientHeight;if(!width||!height)return;
 const dpr=Math.min(devicePixelRatio||1,2);
 lineCanvas.width=Math.round(width*dpr);lineCanvas.height=Math.round(height*dpr);
 lineCtx.setTransform(dpr,0,0,dpr,0,0);lineCtx.clearRect(0,0,width,height);
 // Match the native video pixels, not the letterboxed CSS box.
 const vw=video.videoWidth||16,vh=video.videoHeight||9;
 const scale=Math.min(width/vw,height/vh);
 const visibleW=vw*scale,visibleH=vh*scale;
 const left=(width-visibleW)/2,top=(height-visibleH)/2;
 const y=top+visibleH*tracker.lineFraction;
 lineCtx.strokeStyle='#ffdc54';lineCtx.lineWidth=3;lineCtx.beginPath();lineCtx.moveTo(left,y);lineCtx.lineTo(left+visibleW,y);lineCtx.stroke();
 lineCtx.font='bold 11px Arial';lineCtx.fillStyle='#ffdc54';lineCtx.fillText('COUNTING LINE',left+12,Math.max(16,y-8));
}
window.addEventListener('resize',drawLine);
function clearPreview(){
 preview.width=1024;preview.height=640;ctx.fillStyle='#0d0c17';ctx.fillRect(0,0,preview.width,preview.height);
 text('previewStatus','WAITING FOR VIDEO');text('frameIndicator','No AI frames yet');$('aiEmpty').hidden=false;
}
clearPreview();
async function loadModel(){
 if(model)return model;
 if(loadPromise)return loadPromise;
 loadPromise=(async()=>{
  text('modelStatus','◌ Loading AI model...');notice('Loading YOLO ONNX model into this browser. First use can take time.','info','loading');
  const res=await fetch('/models/yolo26n.onnx',{method:'HEAD'});
  if(!res.ok || (res.headers.get('content-type')||'').includes('text/html'))throw new Error('YOLO ONNX model missing. Run scripts/prepare_model.bat and publish public/models/yolo26n.onnx.');
  const {YOLO}=await import('https://esm.sh/@ultralytics/yolo');
  model=await YOLO.load('/models/yolo26n.onnx');
  text('modelStatus','● Real YOLO ready');text('deviceIndicator',String(model.device||'WebGPU/CPU').toUpperCase());
  return model;
 })().catch(error=>{text('modelStatus','● Model load failed');notice('AI error: '+error.message,'error');loadPromise=null;throw error;});
 return loadPromise;
}
function drawFrame(boxes,at){
 const w=video.videoWidth,h=video.videoHeight;if(!w||!h)return;
 if(preview.width!==w||preview.height!==h){preview.width=w;preview.height=h;}
 ctx.clearRect(0,0,w,h);
 try{ctx.drawImage(video,0,0,w,h);}catch(e){throw new Error('Cannot read video pixels. Remote video may block CORS.');}
 ctx.strokeStyle='#ffdc54';ctx.lineWidth=Math.max(2,w/500);
 const lineY=tracker.lineFraction*h;
 ctx.beginPath();ctx.moveTo(0,lineY);ctx.lineTo(w,lineY);ctx.stroke();
 const f=Math.max(13,w/60);ctx.font=`bold ${f}px Arial`;
 for(const b of boxes){
  const color=colors[b.label]||'#bd83fa';ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,w/500);ctx.strokeRect(b.x1,b.y1,b.x2-b.x1,b.y2-b.y1);if(selectedTrackId===b.trackId){ctx.lineWidth=Math.max(4,w/200);ctx.strokeStyle='#fff';ctx.strokeRect(b.x1,b.y1,b.x2-b.x1,b.y2-b.y1);}
  const tag=`${b.reviewNeeded&&!b.manuallyCorrected?'REVIEW · ':''}${b.label.toUpperCase()} ${b.manuallyCorrected?'✓':b.uncertain?'?':''} ${Math.round(b.conf*100)}% #${b.trackId}`;
  const tagW=ctx.measureText(tag).width+12,tagY=Math.max(0,b.y1-f-8);
  ctx.fillStyle=color;ctx.fillRect(b.x1,tagY,tagW,f+8);ctx.fillStyle='#081018';ctx.fillText(tag,b.x1+6,tagY+f);
 }
 $('aiEmpty').hidden=true;text('previewStatus',scanActive?'● SCANNING FRAMES':'● LIVE AI OUTPUT');
 text('frameIndicator',`Analyzed at ${Number(at||0).toFixed(1)}s · ${boxes.length} vehicles`);
}
function redrawStats(){
 text('totalCount',String(tracker.events.length).padStart(2,'0'));
 text('visibleCount',tracker.visible.length);
 text('reviewCount',tracker.reviewCount);
 $('reviewHint').hidden=tracker.reviewCount===0;
 text('upCount',tracker.up);text('downCount',tracker.down);
 const breakdown=tracker.breakdown,max=Math.max(1,...Object.values(breakdown));
 $('breakdown').replaceChildren(...TYPES.map(type=>{
  const row=document.createElement('div');row.className='break-row';
  const name=document.createElement('span');name.textContent=type[0].toUpperCase()+type.slice(1);
  const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.style.width=(breakdown[type]/max*100)+'%';fill.style.background=colors[type];track.append(fill);
  const number=document.createElement('b');number.textContent=breakdown[type];row.append(name,track,number);return row;
 }));
 if(!tracker.events.length){$('eventList').innerHTML='<p class="empty-text">No tracked vehicle has crossed the selected line yet.</p>';}else{
  $('eventList').replaceChildren(...tracker.events.slice(-14).reverse().map(e=>{
   const row=document.createElement('button');row.type='button';row.className='event-row review-event'+(e.reviewNeeded&&!e.manuallyCorrected?' needs-review':'');row.dataset.trackId=e.id;row.title='Review or correct this vehicle type';
   const left=document.createElement('span');left.textContent=`#${e.id} · ${e.label}${e.reviewNeeded&&!e.manuallyCorrected?' · REVIEW TYPE':''} ✎`;
   const right=document.createElement('b');right.textContent=`${e.direction==='up'?'↑':'↓'} ${e.direction} · ${e.time.toFixed(1)}s`;
   row.append(left,right);return row;
  }));
 }
}
redrawStats();drawLine();
async function analyzeFrame(timestamp){
 if(aiBusy||!sourceType||!video.videoWidth||!video.videoHeight)return;
 aiBusy=true;
 try{
  const ai=await loadModel(),start=performance.now();
  const results=await ai.predict(video,{conf:Number($('confidence').value)/100});
  const boxes=normalizeBoxes(results);
  const updated=tracker.update(boxes,timestamp,video.videoWidth,video.videoHeight);
  drawFrame(updated.objects,timestamp);redrawStats();setFrameFacts(timestamp,updated.objects.length);
  const dt=performance.now()-start;inferenceTimes.push(dt);if(inferenceTimes.length>16)inferenceTimes.shift();
  const ms=inferenceTimes.reduce((a,b)=>a+b,0)/inferenceTimes.length;
  text('inferenceFps',Number(1000/ms).toFixed(1));
  return updated;
 }catch(e){notice('AI detection stopped: '+e.message,'error');stopLoop();throw e;}
 finally{aiBusy=false;}
}
function stopLoop(){loopActive=false;liveRequestId++;}
async function nextFrame(loopId){
 if(!loopActive||liveRequestId!==loopId||scanActive||video.paused||video.ended)return;
 if(previousVideoTime>video.currentTime+0.25){tracker.reset();redrawStats();lastAnalyzedVideoTime=-1;notice('Video seeked backward: tracked count reset for this playback pass.');}
 previousVideoTime=video.currentTime;
 const timestamp=video.currentTime;
 // Only process a new video time point. Frame processing is still limited by device speed.
 if(performance.now()-lastSampleAt>80 && (sourceType==='camera'||Math.abs(timestamp-lastAnalyzedVideoTime)>0.012)){
  lastSampleAt=performance.now();lastAnalyzedVideoTime=timestamp;
  try{await analyzeFrame(timestamp);}catch{return;}
 }
 if(!loopActive||liveRequestId!==loopId)return;
 if(typeof video.requestVideoFrameCallback==='function')video.requestVideoFrameCallback(()=>nextFrame(loopId));
 else setTimeout(()=>nextFrame(loopId),80);
}
async function startLoop(){
 if(scanActive||loopActive||!sourceType)return;
 loopActive=true;const id=++liveRequestId;
 try{await loadModel();}catch{loopActive=false;return;}
 notice(`On-device YOLO is analyzing real frames at ${sourceType==='camera'?'camera speed':video.playbackRate+'× playback'}. Slower playback increases frame sampling opportunities, subject to device performance.`,'info','live');
 nextFrame(id);
}
video.addEventListener('play',startLoop);
video.addEventListener('pause',()=>{stopLoop();if(!scanActive&&sourceType)notice('Video paused. AI will resume when you press Play.','info','paused');});
video.addEventListener('ended',()=>{stopLoop();if(!scanActive)notice('Playback ended. Export CSV or run Sequential analyze for a timeline scan.','info','complete');});
function seek(video,t){return new Promise((resolve,reject)=>{
  if(Math.abs(video.currentTime-t)<.0003)return resolve();
  const cleanup=()=>{video.removeEventListener('seeked',complete);clearTimeout(timer);};
  const complete=()=>{cleanup();resolve();};
  const timer=setTimeout(()=>{cleanup();reject(new Error('Seeking timed out; unsupported codec or media'))},6000);
  video.addEventListener('seeked',complete,{once:true});video.currentTime=t;
 });}
$('scanBtn').onclick=async()=>{
 if(scanActive||!sourceType||sourceType==='camera')return;
 const duration=video.duration;
 if(!Number.isFinite(duration)||duration<=0){notice('Video duration is unknown. Try a local MP4 first.','error');return;}
 if(duration>900){notice('This free browser scanner currently limits one pass to 15-minute videos. Choose a shorter clip.','error');return;}
 try{await loadModel();}catch{return;}
 stopLoop();video.pause();scanActive=true;scanCancel=false;tracker.reset();closeCorrection();redrawStats();
 $('scanBtn').disabled=true;$('stopScanBtn').disabled=false;resetAnalysisFacts();
 const fps=Number($('scanFps').value)||5,step=1/fps;
 const samples=Math.ceil(duration*fps);
 text('countSub',`Sequential scan · ${fps} timeline steps/second`);
 notice(`Scanning ${samples} requested timeline steps at ${fps} steps/sec. Video frames are analyzed locally, one step at a time.`, 'info','scanning');
 try{
  for(let frame=0;frame<samples;frame++){
   if(scanCancel)break;
   const at=Math.min(duration-.0005,frame*step);
   await seek(video,at);await analyzeFrame(at);
   const pc=Math.min(100,Math.round(processedFrames/samples*100));text('progressPercent',pc+'%');$('progressFill').style.width=pc+'%';
   if(frame%3===0)await new Promise(r=>setTimeout(r,0));
  }
  if(!scanCancel)notice(`Completed ${processedFrames} sampled video frames. Counted ${tracker.events.length} tracked line crossings. Your video stayed on this device.`,'info','complete');
  else notice(`Scan stopped after ${processedFrames} processed frames. Partial counts are retained.`,'info','stopped');
 }catch(e){notice('Scan failed: '+e.message,'error','error');}
 finally{scanActive=false;$('stopScanBtn').disabled=true;$('scanBtn').disabled=false;}
};
// Explicit review: the pretrained COCO model has no "van" class, so users may
// correct a visible tracked vehicle. Never silently invent a van prediction.
function closeCorrection(){
 selectedTrackId=null;
 const panel=$('correctionPanel');if(panel)panel.hidden=true;
}
$('clearSelectionBtn').onclick=closeCorrection;
$('eventList').addEventListener('click',e=>{
 const item=e.target.closest('[data-track-id]');if(!item)return;
 const id=Number(item.dataset.trackId),found=tracker.events.find(ev=>ev.id===id);
 if(!found)return;
 selectedTrackId=id;$('correctionPanel').hidden=false;
 text('selectedVehicle',`Crossing #${id} · recorded as ${found.label}`);
 $('correctType').value=found.label;
 text('correctionStatus','Correct the recorded class. This updates statistics and CSV output.');
 $('correctionPanel').scrollIntoView({block:'nearest',behavior:'smooth'});
});
preview.addEventListener('click',event=>{
 if(!tracker.visible.length || !preview.width || !preview.height)return;
 const rect=preview.getBoundingClientRect();
 const factor=Math.min(rect.width/preview.width,rect.height/preview.height);
 const padX=(rect.width-preview.width*factor)/2,padY=(rect.height-preview.height*factor)/2;
 const x=(event.clientX-rect.left-padX)/factor,y=(event.clientY-rect.top-padY)/factor;
 // Choose the smallest box under the pointer when detections overlap.
 const found=tracker.visible.filter(b=>x>=b.x1&&x<=b.x2&&y>=b.y1&&y<=b.y2)
 .sort((a,b)=>(a.x2-a.x1)*(a.y2-a.y1)-(b.x2-b.x1)*(b.y2-b.y1))[0];
 if(!found)return;
 selectedTrackId=found.trackId;
 $('correctionPanel').hidden=false;
 text('selectedVehicle',`Track #${found.trackId} · AI: ${found.rawLabel} ${Math.round(found.conf*100)}%`);
 $('correctType').value=found.label;
 text('correctionStatus',found.label==='bus'||found.label==='truck'?'Bus/Truck predictions can include vans. YOLO has no automatic Van class. Choose Van (manual) if this is a van.':found.reviewNeeded?'The model is uncertain about this type. Please review the vehicle.':'Choose a type and click Correct label.');
});
$('applyCorrectionBtn').onclick=()=>{
 if(selectedTrackId==null)return;
 const type=$('correctType').value;
 if(!tracker.correction(selectedTrackId,type)){
  text('correctionStatus','This track and event are no longer available. Select another one.');return;
 }
 text('correctionStatus',`Track #${selectedTrackId} corrected to ${type}. Existing crossing totals updated.`);
 redrawStats();
 const current={...tracker.visible.find(x=>x.trackId===selectedTrackId)};
 if(current.trackId)drawFrame(tracker.visible,video.currentTime);
};

$('stopScanBtn').onclick=()=>{scanCancel=true;};
$('resetBtn').onclick=()=>{if(scanActive){notice('Stop sequential scan before resetting.');return;}tracker.reset();closeCorrection();redrawStats();resetAnalysisFacts();notice('Counts reset. Select Play or Sequential analyze to start a new count.','info',sourceType?'ready':'idle');};
$('exportBtn').onclick=()=>{
 if(!tracker.events.length){notice('No crossing events to export yet.');return;}
 const csv=csvFromEvents(tracker.events),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='vehicleai-crossings-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
};
$('saveReportBtn').onclick=async()=>{
 const counts=tracker.breakdown;try{
  const r=await api('report',{method:'POST',body:JSON.stringify({source_type:sourceType==='camera'?'camera':sourceType==='url'?'url':'video',...counts})});
  text('reportStatus',`Saved ${r.total} tracked crossings (no video uploaded).`);
 }catch(e){text('reportStatus','Save failed: '+e.message);}
};
$('feedbackForm').onsubmit=async(e)=>{
 e.preventDefault();text('feedbackStatus','Sending...');
 try{await api('feedback',{method:'POST',body:JSON.stringify({rating:Number($('rating').value),message:$('feedbackMessage').value})});text('feedbackStatus','Thank you! Your feedback was saved.');$('feedbackMessage').value='';}
 catch(e){text('feedbackStatus','Unable to save: '+e.message);}
};
window.addEventListener('pagehide',()=>{stopLoop();if(stream)stream.getTracks().forEach(t=>t.stop());clearOldUrl();});
setGate(true);sessionStart();
