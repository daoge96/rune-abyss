"use strict";
const {spawn}=require("child_process");
const fs=require("fs"),path=require("path"),http=require("http");
const CHROME="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT=9411+Math.floor(Math.random()*80);
const OUT=path.join(__dirname,process.env.SHOTS_DIR||"shots");
fs.mkdirSync(OUT,{recursive:true});
const url=process.env.GAME_URL||("file:///"+path.resolve(__dirname,"..","index.html").replace(/\\/g,"/"));
const proc=spawn(CHROME,["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check",
  "--remote-debugging-port="+PORT,"--user-data-dir="+path.join(require("os").tmpdir(),"cdpprof"+PORT),
  "--window-size=1440,900","--hide-scrollbars","about:blank"],{stdio:"ignore"});
function get(pathname){
  return new Promise((res,rej)=>{
    http.get({host:"127.0.0.1",port:PORT,path:pathname},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(JSON.parse(d)))}).on("error",rej);
  });
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,msgId=0,pending=new Map(),errors=[],logs=[];
function send(method,params){
  return new Promise((res,rej)=>{
    const id=++msgId;
    pending.set(id,{res,rej});
    ws.send(JSON.stringify({id,method,params:params||{}}));
    setTimeout(()=>{if(pending.has(id)){pending.delete(id);rej(new Error("timeout "+method))}},20000);
  });
}
async function main(){
  let list=null;
  for(let i=0;i<80&&!list;i++){
    try{const l=await get("/json/list");if(Array.isArray(l)&&l.some(t=>t.type==="page"))list=l}catch(e){}
    if(!list)await sleep(300);
  }
  if(!list){console.log("no page target");process.exit(4)}
  const page=list.find(t=>t.type==="page");
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
  ws.onmessage=(ev)=>{
    const m=JSON.parse(ev.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);return}
    if(m.method==="Runtime.exceptionThrown"){
      const d=m.params.exceptionDetails;
      errors.push((d.exception&&d.exception.description)||d.text);
    }
    if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")errors.push(JSON.stringify(m.params.args.map(a=>a.value)));
    if(m.method==="Log.entryAdded"&&m.params.entry.level==="error")errors.push(m.params.entry.text+" @"+(m.params.entry.url||""));
  };
  await send("Page.enable");await send("Runtime.enable");await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const nav=url+((process.env.GAME_QS)?(url.indexOf("?")<0?"?":"&")+process.env.GAME_QS:"");
  await send("Page.navigate",{url:nav});
  await sleep(1200);
  async function shot(name){
    const r=await send("Page.captureScreenshot",{format:"png"});
    fs.writeFileSync(path.join(OUT,name+".png"),Buffer.from(r.data,"base64"));
    console.log("shot "+name);
  }
  async function key(key,code,vk){
    await send("Input.dispatchKeyEvent",{type:"keyDown",key:key,code:code||key,windowsVirtualKeyCode:vk||0,nativeVirtualKeyCode:vk||0});
    await send("Input.dispatchKeyEvent",{type:"keyUp",key:key,code:code||key,windowsVirtualKeyCode:vk||0,nativeVirtualKeyCode:vk||0});
    await sleep(120);
  }
  async function evalx(expr){
    const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true});
    if(r.exceptionDetails)errors.push("eval: "+JSON.stringify(r.exceptionDetails));
    return r.result&&r.result.value;
  }
  const steps=JSON.parse(fs.readFileSync(path.join(__dirname,"steps.json"),"utf8"));
  for(const st of steps){
    if(st.size)await send("Emulation.setDeviceMetricsOverride",{width:st.size[0],height:st.size[1],deviceScaleFactor:1,mobile:false});
    if(st.eval)await evalx(st.eval);
    if(st.key)await key(st.key,st.code,st.vk);
    if(st.wait)await sleep(st.wait);
    if(st.shot)await shot(st.shot);
  }
  const info=await evalx("(function(){var g=window.RL&&window.RL.G;return g?{depth:g.depth,turn:g.turn,mode:g.mode,hp:g.player.hp,ents:g.level.ents.length}:{none:true}})()");
  console.log("state: "+JSON.stringify(info));
  console.log("errors: "+errors.length);
  errors.slice(0,10).forEach(e=>console.log("  ! "+String(e).slice(0,300)));
  ws.close();proc.kill();
  process.exit(errors.length?2:0);
}
main().catch(e=>{console.log("DRIVER ERROR "+e.message);try{proc.kill()}catch(x){};process.exit(3)});
