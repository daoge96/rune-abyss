"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path");
function anyProxy(onCall){
  const f=function(){};
  const p=new Proxy(f,{
    get(t,k){
      if(k==="width")return 100;
      if(k==="height")return 20;
      if(k==="then")return undefined;
      if(k===Symbol.toPrimitive)return ()=>0;
      if(k==="toString")return ()=>"[proxy]";
      return p;
    },
    set(){return true},
    apply(t,ths,args){if(onCall)onCall(args);return p},
    construct(){return p}
  });
  return p;
}
function mkHarness(file){
  const html=fs.readFileSync(file,"utf8");
  const i=html.indexOf("<script>")+8,j=html.lastIndexOf("</script>");
  const code=html.slice(i,j);
  const listeners={};
  const store={};
  const calls=[];
  let nanCalls=[];
  const ctx2d=anyProxy((args)=>{
    for(const a of args){if(typeof a==="number"&&!Number.isFinite(a))nanCalls.push(args.slice(0,4).join(","))}
  });
  const canvas={width:0,height:0,style:{},getContext:()=>ctx2d,getBoundingClientRect:()=>({left:0,top:0,width:1280,height:800}),focus(){},addEventListener(){}};
  const documentStub={getElementById:()=>canvas,addEventListener:(k,f)=>{listeners["doc:"+k]=f},hidden:false,body:{}};
  let rafCb=null;
  const sandbox={
    console,Math,JSON,Date,Object,Array,String,Number,Boolean,Promise,Set,Map,WeakMap,Error,TypeError,RangeError,
    Int32Array,Uint8Array,Float32Array,Uint16Array,parseInt,parseFloat,isNaN,isFinite,RegExp,Symbol,
    encodeURIComponent,decodeURIComponent,structuredClone,
    performance:{now:()=>clock},
    requestAnimationFrame:(cb)=>{rafCb=cb;return 1},
    cancelAnimationFrame:()=>{},
    setTimeout:(f,t)=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
    localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{}},
    document:documentStub,
    devicePixelRatio:1,innerWidth:1440,innerHeight:900,
    AudioContext:function(){
      this.currentTime=0;this.sampleRate=44100;this.destination={};
      this.createOscillator=()=>({type:"",frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}});
      this.createGain=()=>({gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}});
      this.createBuffer=(c,n,r)=>({getChannelData:()=>new Float32Array(n)});
      this.createBufferSource=()=>({buffer:null,connect(){},start(){}});
    },
    addEventListener:(k,f)=>{listeners[k]=f},
    removeEventListener:()=>{}
  };
  sandbox.window=sandbox;
  sandbox.self=sandbox;
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  let clock=0;
  vm.runInContext(code,sandbox,{filename:path.basename(file),lineOffset:html.slice(0,i).split("\n").length-1});
  const RL=sandbox.RL;
  return {
    ctx:sandbox,RL,listeners,store,canvas,
    get nanCalls(){return nanCalls},
    clearNaN(){nanCalls=[]},
    key(k,code){listeners.keydown&&listeners.keydown({key:k,code:code||k,preventDefault(){},shiftKey:false,ctrlKey:false})},
    frame(dt){clock+=dt;const cb=rafCb;rafCb=null;if(cb)cb(clock)},
    resize(w,h){sandbox.innerWidth=w;sandbox.innerHeight=h;listeners.resize&&listeners.resize()},
    click(x,y,btn){listeners.mousedown&&listeners.mousedown({clientX:x,clientY:y,button:btn===undefined?0:btn,preventDefault(){}});listeners.mouseup&&listeners.mouseup({button:0})},
    move(x,y){listeners.mousemove&&listeners.mousemove({clientX:x,clientY:y})}
  };
}
module.exports={mkHarness,anyProxy};
