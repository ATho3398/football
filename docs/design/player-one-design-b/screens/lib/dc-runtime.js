
class DCLogic { constructor(){ this.props={}; this.state={}; } }
function camel(s){return s.replace(/-([a-z])/g,(m,c)=>c.toUpperCase());}
function get(path,scope){ return path.trim().split('.').reduce((o,k)=>o==null?undefined:o[k],scope); }
function val(str,scope){ const m=str.match(/^\{\{([^}]+)\}\}$/); if(m) return get(m[1],scope); return str.replace(/\{\{([^}]+)\}\}/g,(a,p)=>{const v=get(p,scope);return v==null?'':v;}); }
function styleObj(s){ const o={}; s.split(';').forEach(d=>{const i=d.indexOf(':'); if(i<0)return; const k=d.slice(0,i).trim(), v=d.slice(i+1).trim(); if(!k)return; o[k.startsWith('--')?k:camel(k)]=v;}); return o; }
let KEY=0;
function conv(node,scope){
  if(node.nodeType===3){ const t=node.textContent; if(!t.trim()) return t.includes('\n')?null:t; return val(t,scope); }
  if(node.nodeType!==1) return null;
  const tag=node.tagName.toLowerCase();
  const kids=()=>Array.from(node.childNodes).map(n=>conv(n,scope)).filter(x=>x!=null);
  if(tag==='helmet'||tag==='script') return null;
  if(tag==='sc-for'){ const list=val(node.getAttribute('list'),scope)||[]; const as=node.getAttribute('as'); return list.map(it=>Array.from(node.childNodes).map(n=>conv(n,Object.assign({},scope,{[as]:it}))).filter(x=>x!=null)); }
  if(tag==='sc-if'){ return val(node.getAttribute('value'),scope)?kids():null; }
  const props={key:KEY++};
  for(const a of node.attributes){ if(a.name==='component-from-global-scope') continue; let v=val(a.value,scope);
    if(a.name==='style'&&typeof v==='string') { if(tag==='x-import') props.style=styleObj(v); else props.style=styleObj(v); continue; }
    if(a.name==='class'){props.className=v;continue;}
    props[tag==='x-import'?camel(a.name):(a.name.includes('-')&&!a.name.startsWith('aria')&&!a.name.startsWith('data')?camel(a.name):a.name)]=v; }
  if(tag==='x-import'){ const C=get(node.getAttribute('component-from-global-scope'),window); if(!C){console.error('missing '+node.getAttribute('component-from-global-scope'));return null;} const k=kids(); return React.createElement(C,props,...(k.length?k:[])); }
  const k=kids(); return React.createElement(tag,props,...(k.length?k:[]));
}
const tpl=document.getElementById('tpl').content; const code=document.getElementById('code').textContent;
const Component=new Function('DCLogic',code+'; return Component;')(DCLogic);
const vals=new Component().renderVals();
const root=Array.from(tpl.childNodes).map(n=>conv(n,vals)).filter(x=>x!=null);
ReactDOM.createRoot(document.getElementById('r')).render(React.createElement(React.Fragment,null,...root));
