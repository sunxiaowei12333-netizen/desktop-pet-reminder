/** Exercise the production renderer over EVERY phase, then run six real players. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/xiaowei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.RIG_OUTPUT || path.join(os.tmpdir(), 'rest-moment-rig-review'));
const exportFrames = process.argv.includes('--export');
const ids = ['wave','rest','look','stretch','companion','blink'];
fs.mkdirSync(output, {recursive:true});
const server = http.createServer((req,res)=> {
  try {
    if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<body style="background:#667586;margin:0"></body>');}
    const file = path.join(root,decodeURIComponent(req.url.split('?')[0]));
    if(!file.startsWith(root+path.sep))throw Error('outside root');
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.gif')?'image/gif':'image/png');
    res.end(fs.readFileSync(file));
  } catch {res.statusCode=404;res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1100,height:800},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('saveRigFrame',(id,index,data)=> {
      const dir=path.join(output,'frames',id);fs.mkdirSync(dir,{recursive:true});
      fs.writeFileSync(path.join(dir,`${String(index).padStart(3,'0')}.png`),Buffer.from(data.split(',')[1],'base64'));
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const results=await page.evaluate(async ({ids,exportFrames})=>{
      const {createRigRenderer}=await import('/src/pet-rig-renderer.js');
      const {createRigMesh,deformRig}=await import('/src/pet-rig.js');
      const report={};
      for(const id of ids){
        const image=await createImageBitmap(await(await fetch(`/src/assets/nailao/rig/rig-${id}.png`)).blob());
        const canvas=document.createElement('canvas');canvas.width=canvas.height=448;
        const renderer=createRigRenderer(canvas,()=>({x:0,y:0,width:448,height:448}));
        if(!renderer)throw Error('WebGL unavailable');
        const asset={width:448,height:448,frames:[image],rig:{id}};
        const read=document.createElement('canvas');read.width=read.height=224;const ctx=read.getContext('2d',{willReadFrequently:true});
        const get=phase=>{renderer.draw(asset,{mix:phase},0);ctx.clearRect(0,0,224,224);ctx.drawImage(canvas,0,0,224,224);return ctx.getImageData(0,0,224,224).data;};
        const compare=(a,b)=>{let sum=0,high=0,max=0;for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<4;k++)d=Math.max(d,Math.abs(a[i+k]-b[i+k]));sum+=d;max=Math.max(max,d);if(d>8)high++;}return {mean:sum/(a.length/4),highFraction:high/(a.length/4),max};};
        const areas=[],bottoms=[],deltas=[],minBounds=[448,448,448,448];let green=0,previous,first,loopPixels;
        let minJacobian=Infinity,maxJacobian=0,maxDisplacement=0;
        const mesh=createRigMesh(id);
        const sheet=document.createElement('canvas');sheet.width=224*6;sheet.height=250*4;const sc=sheet.getContext('2d');sc.fillStyle='#667586';sc.fillRect(0,0,sheet.width,sheet.height);
        for(let i=0;i<288;i++){
          const phase=i/288,pixels=get(phase);if(!first)first=pixels;if(previous)deltas.push(compare(previous,pixels).mean);previous=pixels;
          let area=0,bottom=0;
          for(let y=0;y<224;y++)for(let x=0;x<224;x++){const n=(y*224+x)*4;if(pixels[n+3]<=128)continue;area++;bottom=Math.max(bottom,y);minBounds[0]=Math.min(minBounds[0],x*2);minBounds[1]=Math.min(minBounds[1],y*2);minBounds[2]=Math.min(minBounds[2],(223-x)*2);minBounds[3]=Math.min(minBounds[3],(223-y)*2);if(pixels[n+1]-Math.max(pixels[n],pixels[n+2])>8)green++;}
          areas.push(area);bottoms.push(bottom);
          const v=deformRig(mesh,phase),s=mesh.source,idx=mesh.indices;
          for(let n=0;n<v.length;n+=2)maxDisplacement=Math.max(maxDisplacement,Math.hypot(v[n]-s[n],v[n+1]-s[n+1]));
          for(let n=0;n<idx.length;n+=3){const a=idx[n]*2,b=idx[n+1]*2,c=idx[n+2]*2;const determinant=((v[b]-v[a])*(v[c+1]-v[a+1])-(v[b+1]-v[a+1])*(v[c]-v[a]))/16;minJacobian=Math.min(minJacobian,determinant);maxJacobian=Math.max(maxJacobian,determinant);}
          if(i%12===0){const k=i/12,x=k%6*224,y=Math.floor(k/6)*250;sc.drawImage(canvas,x,y,224,224);sc.fillStyle='white';sc.font='14px sans-serif';sc.fillText(`${id} ${(phase*4.8).toFixed(1)}s`,x+8,y+242);}
        }
        loopPixels=compare(first,get(1));deltas.push(compare(previous,first).mean);
        // Probe continuous time on both sides of all 288 phases, including wrap.
        let maxTinyMean=0,maxTinyFraction=0;
        for(let i=0;i<288;i++){const d=compare(get(i/288-1e-6),get(i/288+1e-6));maxTinyMean=Math.max(maxTinyMean,d.mean);maxTinyFraction=Math.max(maxTinyFraction,d.highFraction);}
        if(exportFrames)for(let i=0;i<120;i++){renderer.draw(asset,{mix:i/120},0);await window.saveRigFrame(id,i,canvas.toDataURL());}
        report[id]={samples:288,durationMs:4800,sizeVariation:Math.sqrt(Math.max(...areas)/Math.min(...areas))-1,groundDriftPx:(Math.max(...bottoms)-Math.min(...bottoms))*2,minBounds,greenPixels:green,minJacobian,maxJacobian,maxDisplacementPx:maxDisplacement,loopPixels,maxTinyMean,maxTinyFraction,maxFrameDelta:Math.max(...deltas),p95FrameDelta:[...deltas].sort((a,b)=>a-b)[Math.floor(deltas.length*.95)],...renderer.getStats(),sheet:sheet.toDataURL('image/jpeg',.9)};
        renderer.destroy();image.close();
      }
      return report;
    },{ids,exportFrames});
    for(const [id,r] of Object.entries(results)){fs.writeFileSync(path.join(output,`${id}-full-cycle.jpg`),Buffer.from(r.sheet.split(',')[1],'base64'));delete r.sheet;}
    // Actual production lifecycle: six RAF players at desktop physical resolution.
    const performanceReport=await page.evaluate(async ids=>{
      const {createPetAnimation}=await import('/src/pet-animation.js');const players=[],canvases=[];
      for(const id of ids){const c=document.createElement('canvas');c.style.cssText='width:183px;height:199px;display:inline-block';document.body.append(c);canvases.push(c);players.push(createPetAnimation(c,{src:`/src/assets/nailao/nailao-action-${id}-image2.gif`,motion:{kind:'fixed-rig',id,src:`/src/assets/nailao/rig/rig-${id}.png`,durationMs:4800}}));}
      const ready=await Promise.all(players.map(p=>p.ready));await new Promise(r=>setTimeout(r,200));
      const times=[];await new Promise(resolve=>{let start,last;function tick(now){if(start===undefined)start=now;if(last!==undefined)times.push(now-last);last=now;if(now-start>=14400)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
      const stats=players.map(p=>p.getStats());const elapsed=times.reduce((a,b)=>a+b,0),sorted=[...times].sort((a,b)=>a-b);
      players.forEach(p=>p.destroy());const counts=players.map(p=>p.getStats().renderedFrames);await new Promise(r=>setTimeout(r,100));const stopped=players.every((p,i)=>p.getStats().renderedFrames===counts[i]);canvases.forEach(c=>c.remove());
      // Force just this canvas down the no-WebGL route and verify full GIF playback.
      const c=document.createElement('canvas');c.style.cssText='width:183px;height:199px';document.body.append(c);const original=c.getContext.bind(c);c.getContext=(name,...args)=>name==='webgl'?null:original(name,...args);
      const fallback=createPetAnimation(c,{src:'/src/assets/nailao/nailao-action-wave-image2.gif',motion:{kind:'fixed-rig',id:'wave',src:'/src/assets/nailao/rig/rig-wave.png',durationMs:4800}});const fallbackReady=await fallback.ready;fallback.destroy();c.remove();
      return {loops:3,fps:times.length/elapsed*1000,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...times),over25Ms:times.filter(x=>x>25).length,ready,stats,destroyStopsFrames:stopped,fallbackReady};
    },ids);
    const report={createdAt:new Date().toISOString(),method:'production fixed-texture WebGL renderer, 288 phases per action + 3 real-time loops of six production players',actions:results,playback:performanceReport,errors};
    const checks=[];const check=(name,condition)=>checks.push({name,pass:!!condition});
    for(const [id,r] of Object.entries(results)){
      check(`${id}: size <2%`,r.sizeVariation<.02);check(`${id}: fixed ground <=2px`,r.groundDriftPx<=2);check(`${id}: 24px safety`,r.minBounds.every(x=>x>=24));check(`${id}: no green spill`,r.greenPixels===0);
      check(`${id}: mesh never folds`,r.minJacobian>.02);check(`${id}: actual motion`,r.maxDisplacementPx>4);
      check(`${id}: one immutable texture`,r.textureUploads===1&&r.sourceTextures===1);
      check(`${id}: exact looping pose`,r.loopPixels.max===0);check(`${id}: no texture discontinuity`,r.maxTinyMean<.1&&r.maxTinyFraction<.001);
      check(`${id}: no adjacent-frame pop`,r.maxFrameDelta<2);
    }
    check('six players run smoothly',performanceReport.fps>=55&&performanceReport.p95Ms<25&&performanceReport.over25Ms<=3);
    check('cleanup stops rendering',performanceReport.destroyStopsFrames);
    check('six production rig players',performanceReport.ready.every(r=>r.renderer==='webgl-fixed-texture-rig'&&r.frameCount===1&&r.duration===4800));
    check('animated fallback matches duration',performanceReport.fallbackReady.duration===4800&&performanceReport.fallbackReady.frameCount>=100);
    check('no browser errors',errors.length===0);report.checks=checks;report.pass=checks.every(c=>c.pass);
    fs.writeFileSync(path.join(output,'joint-audit.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({output,pass:report.pass,failed:checks.filter(c=>!c.pass),actions:results,playback:performanceReport},null,2));
    assert.ok(report.pass,'Joint animation gate failed; inspect joint-audit.json and all full-cycle sheets');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
