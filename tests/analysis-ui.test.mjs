import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
test('analysis status monitor has clear headings and real frame counters',()=>{
 for(const id of ['analysisMonitor','analysisPhase','analysisHeading','processingText','analysisFrameCount','analysisFrameTime','analysisFrameVehicles','progressPercent','progressFill'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/processedFrames\+\+/);
 assert.match(app,/setFrameFacts\(timestamp,updated\.objects\.length\)/);
 assert.match(app,/processedFrames\/samples/);
 assert.match(css,/prefers-reduced-motion/);
});
test('YouTube links show local-upload guidance instead of false AI support',()=>{
 assert.match(html,/YouTube videos cannot be analyzed/);
 assert.match(html,/videoLinkWarning/);
 assert.match(app,/videoLinkWarning.*hidden=false/);
 assert.doesNotMatch(html,/youtubeFrame/);
 assert.doesNotMatch(app,/youtube-nocookie\.com\/embed/);
});
