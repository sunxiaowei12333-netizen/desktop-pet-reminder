const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'),stage=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'pet-renderer-'));
console.log('Report directory:',stage);
const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<html><body style="margin:0;background:#64748b"></body></html>');}try{const f=path.join(root,decodeURIComponent(req.url));res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.gif')?'image/gif':f.endsWith('.png')?'image/png':'application/json');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage({viewport:{width:1100,height:250},deviceScaleFactor:2});page.on('pageerror',e=>console.error(e));await page.goto(`http://127.0.0.1:${server.address().port}`);
const checks=await page.evaluate(async()=>{
 const {createMotionRenderer}=await import('/src/pet-motion-renderer.js');
 const c=document.createElement('canvas');c.width=c.height=128;document.body.append(c);
 function pose(x){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(x,24,12,12);return c;}
 const atlas=document.createElement('canvas');atlas.width=atlas.height=128;const ctx=atlas.getContext('2d');for(let i=0;i<4;i++){ctx.fillStyle=`rgb(${[192,64,64,192][i]},128,255)`;ctx.fillRect((i%2)*64,Math.floor(i/2)*64,64,64);}
 const a={width:64,height:64,frames:[pose(16),pose(24)],motion:{atlas,range:16,gridSize:64,columns:2}};
 const renderer=createMotionRenderer(c,()=>({x:0,y:0,width:128,height:128}));
 function read(c){const gl=c.getContext('webgl'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;}
 const synthetic=[];for(const mix of [0,.2,.4,.49,.51,.6,.8,.99]){renderer.draw(a,{index:0,next:1,mix},0);const p=read(c);let left=128,right=-1,opaque=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(p[(y*128+x)*4+3]>240){left=Math.min(left,x);right=Math.max(right,x);opaque++;}synthetic.push({mix,left,right,width:right-left+1,opaque});}
 renderer.destroy();c.remove();

 // Check all 96 transitions, including loop seams, for interior material pops.
 const specs=await(await fetch('/src/assets/nailao/motion-manifest.json')).json();
 const flicker=[];
 for(const [id,spec] of Object.entries(specs)) {
   const decoder=new ImageDecoder({data:await(await fetch(`/src/assets/nailao/nailao-action-${id}-image2.gif`)).arrayBuffer(),type:'image/gif'});
   await decoder.tracks.ready;const frames=[];
   for(let i=0;i<16;i++){const {image}=await decoder.decode({frameIndex:i});frames.push(await createImageBitmap(image));image.close();}decoder.close();
   const atlas=await createImageBitmap(await(await fetch(`/src/assets/nailao/motion-${id}.png`)).blob());
   const asset={width:448,height:448,frames,motion:{...spec,atlas}};
   const results=[];
   for(const make of [createMotionRenderer]){
     const c=document.createElement('canvas');c.width=c.height=224;const r=make(c,()=>({x:0,y:0,width:224,height:224}));let sum=0,count=0,flashes=0;
     for(let i=0;i<16;i++) {
       r.draw(asset,{index:i,next:(i+1)%16,mix:.4999},0);const a=read(c);
       r.draw(asset,{index:i,next:(i+1)%16,mix:.5001},0);const b=read(c);
       for(let y=4;y<220;y++)for(let x=4;x<220;x++) {
         const j=(y*224+x)*4;
         if([j,j-16,j+16,j-224*16,j+224*16].some(k=>a[k+3]<254||b[k+3]<254))continue;
         const delta=(Math.abs(a[j]-b[j])+Math.abs(a[j+1]-b[j+1])+Math.abs(a[j+2]-b[j+2]))/3;
         sum+=delta;count++;if(delta>8)flashes++;
       }
     }
     results.push({meanInteriorJump:sum/count,flashingPixelsFraction:flashes/count});r.destroy();
   }
   flicker.push({action:id,after:results[0]});frames.forEach(f=>f.close());atlas.close();
 }
 // Different coat colors must interpolate continuously while coverage stays opaque.
 const cc=document.createElement('canvas');cc.width=cc.height=128;
 const colorA=pose(16),colorB=pose(24);
 for(const [c,color,x] of [[colorA,'rgb(200,120,80)',16],[colorB,'rgb(100,160,200)',24]]){const g=c.getContext('2d');g.fillStyle=color;g.fillRect(x,24,12,12);}
 const cr=createMotionRenderer(cc,()=>({x:0,y:0,width:128,height:128}));const ca={...a,frames:[colorA,colorB]};
 let colorTransition=[];for(const mix of [.4999,.5001]){cr.draw(ca,{index:0,next:1,mix},0);colorTransition.push([...read(cc).slice((68*128+52)*4,(68*128+52)*4+4)]);}cr.destroy();

 // Regression: two paws over an OPAQUE torso, with an intentionally ambiguous flow.
 // Alpha-only protection used to blend two dark paw marks into this solid chest.
 const body=document.createElement('canvas');body.width=body.height=64;
 const bodyCtx=body.getContext('2d');bodyCtx.fillStyle='rgb(220,220,220)';bodyCtx.fillRect(8,8,48,48);
 const pawA=document.createElement('canvas'),pawB=document.createElement('canvas');
 for(const [p,x] of [[pawA,20],[pawB,36]]){p.width=p.height=64;const ctx=p.getContext('2d');ctx.drawImage(body,0,0);ctx.fillStyle='rgb(40,40,40)';ctx.fillRect(x,24,8,8);}
 const forbidden=document.createElement('canvas');forbidden.width=forbidden.height=128;const fc=forbidden.getContext('2d');fc.fillStyle='rgb(128,128,0)';fc.fillRect(0,0,128,128);
 const gc=document.createElement('canvas');gc.width=gc.height=128;const gr=createMotionRenderer(gc,()=>({x:0,y:0,width:128,height:128}));
 const ga={...a,frames:[pawA,pawB],motion:{...a.motion,atlas:forbidden}};const internalGhost=[];
 for(const mix of [.1,.25,.49,.5,.51,.75,.9]){
   gr.draw(ga,{index:0,next:1,mix},0);const px=read(gc);
   const first=px[(72*128+46)*4],second=px[(72*128+78)*4];
   internalGhost.push({mix,first,second});
 }
 gr.destroy();
 const {createPetAnimation}=await import('/src/pet-animation.js');const meta=await(await fetch('/src/assets/nailao/motion-manifest.json')).json();
 window.__nativeRAF=window.requestAnimationFrame.bind(window);window.__nativeCAF=window.cancelAnimationFrame.bind(window);let callbacks=new Map(),rid=0;window.requestAnimationFrame=cb=>(callbacks.set(++rid,cb),rid);window.cancelAnimationFrame=id=>callbacks.delete(id);window.tick=t=>{const q=[...callbacks.values()];callbacks.clear();q.forEach(cb=>cb(t));};window.players=[];window.canvases=[];
 for(const id of Object.keys(meta)){const c=document.createElement('canvas');c.style.cssText='width:183px;height:199px';document.body.append(c);const player=createPetAnimation(c,{src:`/src/assets/nailao/nailao-action-${id}-image2.gif`,motion:{src:`/src/assets/nailao/motion-${id}.png`,...meta[id]},alignment:'left'});const ready=await player.ready;window.players.push(player);window.canvases.push(c);}
 await new Promise(r=>setTimeout(r,100));
 const hashes=Object.fromEntries(Object.keys(meta).map(id=>[id,new Set()]));let borders=0,green=0;
 for(let n=0;n<200;n++){window.tick(n*1000/60);for(let i=0;i<canvases.length;i++){const c=canvases[i],p=read(c);let hash=2166136261;for(let j=0;j<p.length;j+=4){hash=Math.imul(hash^p[j],16777619);hash=Math.imul(hash^p[j+3],16777619);}hashes[Object.keys(meta)[i]].add(hash>>>0);if(true){for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const j=(y*c.width+x)*4;if((x<2||y<2||x>=c.width-2||y>=c.height-2)&&p[j+3]>16)borders++;if(p[j+3]>128&&p[j+1]-Math.max(p[j],p[j+2])>8)green++;}}}}
 const result={synthetic,internalGhost,flicker,colorTransition,distinctFrames:Object.fromEntries(Object.entries(hashes).map(([id,s])=>[id,s.size])),borders,green,renderers:players.map(p=>p.getStats())};
 window.tick(1000);return result;
});
fs.writeFileSync(path.join(stage,'browser-debug.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));assert.ok(checks.synthetic.every(s=>s.width<=24&&s.opaque>=480),'a moving opaque pose must stay single and solid');assert.ok(checks.synthetic.at(-1).left>checks.synthetic[0].left);assert.equal(checks.borders,0);assert.equal(checks.green,0);for(const [id,n] of Object.entries(checks.distinctFrames))assert.ok(n>120,`${id} only ${n} visually distinct frames`);assert.ok(checks.renderers.every(r=>r.renderer==='webgl-occlusion-protected-motion'));
assert.ok(checks.internalGhost.every(f=>f.mix<.5 ? f.first===40&&f.second===220 : f.first===220&&f.second===40),'occluded internal features must stay one solid detail, never two faded paw marks');assert.ok(checks.colorTransition.every(p=>p[3]===255));assert.ok(checks.colorTransition[0].every((v,i)=>Math.abs(v-checks.colorTransition[1][i])<=1));
await page.waitForTimeout(200);await page.screenshot({path:path.join(stage,'six-smooth-preview.png')});
const performance=await page.evaluate(async()=>{
 players.forEach(p=>p.destroy());document.body.innerHTML='';
 const {createPetAnimation}=await import('/src/pet-animation.js');const meta=await(await fetch('/src/assets/nailao/motion-manifest.json')).json();
 window.requestAnimationFrame=window.__nativeRAF;window.cancelAnimationFrame=window.__nativeCAF;
 const ps=[];for(const id of Object.keys(meta)){const c=document.createElement('canvas');c.style.cssText='width:183px;height:199px';document.body.append(c);const p=createPetAnimation(c,{src:`/src/assets/nailao/nailao-action-${id}-image2.gif`,motion:{src:`/src/assets/nailao/motion-${id}.png`,...meta[id]},alignment:'left'});await p.ready;ps.push(p);}
 await new Promise(r=>setTimeout(r,250));const start=performance.now(),before=ps.map(p=>p.getStats().renderedFrames);
 await new Promise(r=>setTimeout(r,3000));const milliseconds=performance.now()-start;
 const result=ps.map((p,i)=>({action:Object.keys(meta)[i],fps:(p.getStats().renderedFrames-before[i])*1000/milliseconds,renderer:p.getStats().renderer}));
 ps.forEach(p=>p.destroy());return {milliseconds,actions:result};
});
assert.ok(performance.actions.every(a=>a.fps>=40),'simultaneous six-action preview must sustain at least 40 fps');checks.performance=performance;
await browser.close();server.close();fs.writeFileSync(path.join(stage,'browser-verification.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));
})().catch(e=>{console.error(e);server.close();process.exit(1);});
