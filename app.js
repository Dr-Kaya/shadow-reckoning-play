const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d',{alpha:false});
const images=new Map(),buffers=new Map();let game,pyodide,audioContext,music,gain,ready=false,last=0,lastStatus='',lastScore='',soundOn=true;
const roster=['NORRIS','ARNOLD','STALLONE','ROCK','DRAGON','ATLAS','VESPER','PYRE'];
for(const id of ['player','opponent']) for(const name of roster){const o=document.createElement('option');o.value=name;o.textContent=name==='ROCK'?'THE ROCK':name;$('#'+id).append(o);}$('#opponent').value='ARNOLD';
const aliases={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Space:'space',ShiftLeft:'shift_l',ShiftRight:'shift_r',Enter:'return',Escape:'escape',F1:'f1',F11:'f11',Tab:'tab'};
const keyName=e=>aliases[e.code]||(e.code.startsWith('Key')?e.code.slice(3).toLowerCase():e.key.toLowerCase());
const handled=new Set([...Object.values(aliases),...'wasdjkleifruopnhyvqtgmb123']);
function unlockAudio(){if(!audioContext){audioContext=new(window.AudioContext||window.webkitAudioContext)();gain=audioContext.createGain();gain.gain.value=.3;gain.connect(audioContext.destination);}audioContext.resume().catch(()=>{});}
async function fetchOK(path){const r=await fetch(path);if(!r.ok)throw new Error(`Could not load ${path} (${r.status})`);return r;}
function progress(message,value){$('#load-message').textContent=message;$('#progress').value=value;$('#status').textContent=message;}
async function launch(){
 $('#launch').disabled=true;$('#progress').hidden=false;$('#load-detail').textContent='Loading is faster on later visits.';
 try{
  unlockAudio();progress('Preparing the arena…',5);
  const runtimePromise=fetchOK('runtime.json').then(r=>r.json());
  const manifest=await(await fetchOK('assets.json')).json();
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.js';
  const runtimeReady=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('The browser runtime could not load. Check your internet connection and retry.'));});document.head.append(script);
  let loaded=0;const queue=[...manifest.images];
  const artReady=Promise.all(Array.from({length:8},async()=>{while(queue.length){const path=queue.shift();const img=new Image();img.src=path;await img.decode();images.set(path,img);loaded++;progress(`Loading artwork · ${loaded}/${manifest.images.length}`,10+loaded/manifest.images.length*50);}}));
  const soundReady=Promise.all(manifest.audio.map(async path=>{try{const data=await(await fetchOK(path)).arrayBuffer();buffers.set(path.split('/').pop().slice(0,-4),await audioContext.decodeAudioData(data));}catch(error){console.warn('Sound unavailable',path,error);}}));
  await runtimeReady;pyodide=await window.loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/'});
  const runtime=await runtimePromise;
  for(const [path,text] of Object.entries(runtime)){const target='/game/'+path;pyodide.FS.mkdirTree(target.slice(0,target.lastIndexOf('/')));pyodide.FS.writeFile(target,text);}
  await artReady;progress('Awakening the fighters…',85);
  await pyodide.runPythonAsync("import sys\nsys.path.insert(0, '/game')\nexec(compile(open('/game/bridge.py').read(), '/game/bridge.py', 'exec'))");
  game=pyodide.globals.get('browser_game');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)pyodide.runPython("GRAPHICS['camera_shake']=False; GRAPHICS['hit_flash']=False");
  await soundReady;ready=true;$('#loading').hidden=true;$('#toolbar').hidden=false;
  if(matchMedia('(pointer:coarse)').matches)$('#touch').hidden=false;
  canvas.focus();last=performance.now();requestAnimationFrame(frame);
 }catch(error){console.error(error);$('#load-message').textContent=error.message;$('#load-detail').textContent='Refresh this page to try again, or download the Mac app above.';$('#launch').textContent='Reload and retry';$('#launch').disabled=false;$('#launch').onclick=()=>location.reload();$('#status').textContent='Could not start the game';}
}
$('#launch').onclick=launch;
function draw(commands){
 ctx.fillStyle='#08070a';ctx.fillRect(0,0,1100,660);
 for(const item of commands){if(!item)continue;const[type,a,o]=item;ctx.save();if(o.offset)ctx.translate(...o.offset);ctx.lineWidth=o.width||1;ctx.lineJoin='round';ctx.lineCap='round';
  if(type==='image'){const spec=typeof o.image==='string'?{path:o.image,scale:1}:o.image;const img=images.get(spec.path);if(img){const w=img.width*spec.scale,h=img.height*spec.scale;let[x,y]=a;const anchor=o.anchor||'center';if(anchor==='s'){x-=w/2;y-=h;}else if(anchor!=='nw'){x-=w/2;y-=h/2;}ctx.drawImage(img,x,y,w,h);}}
  else if(type==='text'){
   const[family,size,weight]=o.font;const fonts={Georgia:'Georgia, serif',Menlo:'Menlo, Consolas, monospace',Helvetica:'Arial, sans-serif'};ctx.font=`${weight} ${Math.abs(size)}px ${fonts[family]||'sans-serif'}`;ctx.fillStyle=o.fill;const anchor=o.anchor||'center';ctx.textAlign=anchor.includes('w')?'left':anchor.includes('e')?'right':'center';ctx.textBaseline=anchor.includes('n')?'top':anchor.includes('s')?'bottom':'middle';
   const text=String(o.text);if(o.width>0){const words=text.split(' '),lines=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>o.width&&line){lines.push(line);line=word;}else line=test;}lines.push(line);lines.forEach((line,i)=>ctx.fillText(line,a[0],a[1]+i*Math.abs(size)*1.2));}else ctx.fillText(text,...a);
  }else{
   ctx.beginPath();if(type==='rect')ctx.rect(a[0],a[1],a[2]-a[0],a[3]-a[1]);
   else if(type==='oval')ctx.ellipse((a[0]+a[2])/2,(a[1]+a[3])/2,Math.max(0,(a[2]-a[0])/2),Math.max(0,(a[3]-a[1])/2),0,0,Math.PI*2);
   else{ctx.moveTo(a[0],a[1]);for(let i=2;i<a.length;i+=2)ctx.lineTo(a[i],a[i+1]);if(type==='polygon')ctx.closePath();}
   if(type==='line'){ctx.strokeStyle=o.fill;ctx.stroke();}else{if(o.fill){ctx.fillStyle=o.fill;ctx.fill();}if(o.outline){ctx.strokeStyle=o.outline;ctx.stroke();}}
  }ctx.restore();
 }
}
const eventAliases={impact_super:'super',break:'block',jump:'dash'};const recentlyPlayed=new Map();let voices=0;
function audioTick(state){
 soundOn=state.sound;
 if(music&&(!state.sound||!state.music)){music.stop();music=null;}
 if(state.sound&&state.music&&!music&&buffers.has('eclipse')){music=audioContext.createBufferSource();music.buffer=buffers.get('eclipse');music.loop=true;music.connect(gain);music.start();}
 if(!state.sound)return;const now=performance.now();
 for(const event of state.sounds){const name=eventAliases[event]||event,buffer=buffers.get(name);if(!buffer||voices>=6||now-(recentlyPlayed.get(name)||0)<75)continue;recentlyPlayed.set(name,now);const source=audioContext.createBufferSource(),volume=audioContext.createGain();volume.gain.value=.6;source.buffer=buffer;source.connect(volume).connect(audioContext.destination);voices++;source.onended=()=>{voices--;volume.disconnect();source.disconnect();};source.start();}
}
function frame(now){if(!ready)return;try{const state=JSON.parse(game.tick(Math.min(.04,(now-last)/1000)));last=now;draw(state.commands);audioTick(state);
 const names={title:'Choose your fighter',fight:state.mode==='training'?'Training · Practice your moves':'Fight',intro:'Get ready',paused:'Paused · Resume when ready',moves:'Move guide',options:'Options',round_end:'Round complete',training_reset:'Training reset',finish_window:'Finish them!',finisher:'Final technique',match_end:'Match complete'};
 const status=names[state.state]||state.state;if(status!==lastStatus){$('#status').textContent=status;lastStatus=status;canvas.dataset.state=state.state;}
 const score=state.state==='title'?'Arcade vs CPU · Training · Two players on one keyboard':state.fighters.map((f,i)=>`${i===0?'P1':state.mode==='versus'?'P2':'CPU'} ${f.name}: ${f.hp} HP · ${f.meter} energy · ${f.wins} wins`).join('  /  ');
 if(score!==lastScore){$('#score').textContent=score;lastScore=score;}
 for(const [id,value] of [['player',state.selected],['opponent',state.opponent],['difficulty',String(state.difficulty)]]){if(document.activeElement!==$('#'+id))$('#'+id).value=value;}$('#pause').textContent=state.state==='paused'?'Resume':'Pause';$('#sound').textContent=state.sound?'Sound on':'Muted';$('#sound').setAttribute('aria-pressed',String(state.sound));
 requestAnimationFrame(frame);
 }catch(error){console.error(error);ready=false;$('#status').textContent='The game stopped. Refresh the page to restart.';}}
function coordinates(e){const b=canvas.getBoundingClientRect();return[(e.clientX-b.left)*1100/b.width,(e.clientY-b.top)*660/b.height];}
canvas.addEventListener('pointermove',e=>{if(ready)game.pointer(...coordinates(e),false);});canvas.addEventListener('click',e=>{if(ready){unlockAudio();canvas.focus();game.pointer(...coordinates(e),true);}});
canvas.addEventListener('keydown',e=>{if(!ready)return;const key=keyName(e);if(!handled.has(key))return;e.preventDefault();if(key==='f11'){fullscreen();return;}if(!e.repeat){unlockAudio();game.key(key,true);}});
window.addEventListener('keyup',e=>{if(ready)game.key(keyName(e),false);});
function pause(){if(ready){game.blur();if(music){music.stop();music=null;}}}window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});canvas.addEventListener('blur',pause);
for(const el of document.querySelectorAll('[data-action]')){el.addEventListener('pointerdown',e=>e.preventDefault());el.addEventListener('click',()=>{if(!ready)return;unlockAudio();game.action(el.dataset.action);canvas.focus();});}
for(const id of ['player','opponent','difficulty'])$('#'+id).addEventListener('change',()=>{if(ready)game.select($('#player').value,$('#opponent').value,Number($('#difficulty').value));});
for(const el of document.querySelectorAll('[data-key]')){el.addEventListener('pointerdown',e=>{if(!ready)return;e.preventDefault();el.setPointerCapture(e.pointerId);unlockAudio();canvas.focus();game.key(el.dataset.key,true);});for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,e=>{if(ready)game.key(el.dataset.key,false);});}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#stage').requestFullscreen();}catch{ $('#status').textContent='Fullscreen is unavailable in this browser.';}}$('#fullscreen').onclick=fullscreen;
