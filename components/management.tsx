'use client';
import { useCallback,useEffect,useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Database, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
type Row={id:string;title:string;details:string;created_at:string;[key:string]:unknown};
type Mode='read'|'update'|'crud';
type Collection={key:string;name:string;mode:Mode;help:string};
const collections:Collection[]=[
 {key:'chains',name:'Prompt chains',mode:'read',help:'Configured prompt pipelines'},
 {key:'steps',name:'Prompt chain steps',mode:'read',help:'Individual stages and their order'},
 {key:'mix',name:'Prompt chain mix',mode:'update',help:'Adjust existing chain mix entries'},
 {key:'terms',name:'Terms',mode:'crud',help:'Terms and reusable vocabulary'},
 {key:'media',name:'AI generated media',mode:'read',help:'Generated movie review content'},
 {key:'requests',name:'Generation requests',mode:'read',help:'Recorded generation requests'},
 {key:'examples',name:'AI generation examples',mode:'crud',help:'Example input-output content'},
 {key:'models',name:'LLM models',mode:'crud',help:'Model catalog'},
 {key:'providers',name:'LLM providers',mode:'crud',help:'Provider catalog'},
 {key:'responses',name:'LLM responses',mode:'read',help:'Recorded model output'},
 {key:'domains',name:'Allowed signup domains',mode:'crud',help:'Domain allowlist records'},
 {key:'emails',name:'Whitelisted emails',mode:'crud',help:'Individual email allowlist records'},
 {key:'images',name:'Images',mode:'crud',help:'Movie posters and image assets'},
];
export default function Management(){
 const [selected,setSelected]=useState('chains');const [rows,setRows]=useState<Row[]>([]);
 const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const [editing,setEditing]=useState<Row|null>(null);const [creating,setCreating]=useState(false);
 const [title,setTitle]=useState('');const [details,setDetails]=useState('');const [saving,setSaving]=useState(false);
 const current=collections.find(c=>c.key===selected)!;
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/management?type='+encodeURIComponent(selected),{cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to fetch records');
   setRows(data.rows||[]);
  }catch(e){setRows([]);setError(e instanceof Error?e.message:'Unable to load')}
  finally{setLoading(false)}
 },[selected]);
 useEffect(()=>{void load()},[load]);
 function edit(row:Row){setEditing(row);setCreating(false);setTitle(row.title);setDetails(row.details)}
 function create(){setCreating(true);setEditing(null);setTitle('');setDetails('')}
 async function mutate(action:'create'|'update'|'delete',row?:Row){
  if(action==='delete'&&!window.confirm('Permanently delete this record?'))return;
  setSaving(true);setError('');
  try{
   const response=await fetch('/api/management',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:selected,action,id:row?.id||editing?.id,title:action==='delete'?row?.title:title,details:action==='delete'?row?.details:details})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Operation failed');
   setEditing(null);setCreating(false);await load();
  }catch(e){setError(e instanceof Error?e.message:'Operation failed')}
  finally{setSaving(false)}
 }
 return <div style={{minHeight:'100vh',background:'#f7f7fa',padding:'30px clamp(16px,4vw,58px)'}}>
 <header style={{display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',marginBottom:30}}>
 <Link href="/" style={{color:'#7060df',display:'flex',alignItems:'center',gap:6,textDecoration:'none'}}><ArrowLeft size={17}/> Dashboard</Link>
 <Database color="#7060df"/><h1 style={{fontSize:25,margin:0}}>AI & Platform Management</h1>
 </header>
 <div style={{display:'grid',gridTemplateColumns:'minmax(180px,250px) minmax(0,1fr)',gap:24,alignItems:'start'}}>
 <nav aria-label="Management collections" style={{background:'white',border:'1px solid #e8e8ef',borderRadius:13,padding:10,display:'grid',gap:3}}>
 {collections.map(c=><button key={c.key} onClick={()=>{setSelected(c.key);setEditing(null);setCreating(false)}} style={{textAlign:'left',border:0,borderRadius:8,padding:'12px 11px',background:selected===c.key?'#eeebff':'transparent',color:selected===c.key?'#5544c4':'#5c5d6a',fontWeight:selected===c.key?700:500}}>{c.name}</button>)}
 </nav>
 <section style={{minWidth:0}}>
 <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
 <div><h2 style={{margin:'0 0 7px'}}>{current.name}</h2><p style={{color:'#828394',fontSize:13,margin:0}}>{current.help} · {current.mode==='crud'?'Create / Read / Update / Delete':current.mode==='update'?'Read / Update':'Read only'}</p></div>
 <div style={{display:'flex',gap:9}}><button className="secondary" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>{current.mode==='crud'&&<button className="primary" onClick={create}><Plus size={16}/> Add new</button>}</div>
 </div>
 {error&&<p role="alert" className="form-error">{error}</p>}
 {(editing||creating)&&<form onSubmit={e=>{e.preventDefault();void mutate(creating?'create':'update')}} className="panel" style={{padding:22,display:'grid',gap:13,marginTop:18}}>
 <label>Title / value<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} style={{display:'block',padding:12,width:'100%',marginTop:7,border:'1px solid #dedeea',borderRadius:7}}/></label>
 <label>Details<textarea value={details} onChange={e=>setDetails(e.target.value)} rows={3} style={{display:'block',padding:12,width:'100%',marginTop:7,border:'1px solid #dedeea',borderRadius:7}}/></label>
 <div style={{display:'flex',gap:10}}><button disabled={saving} className="primary" type="submit">{saving?'Saving...':'Save'}</button><button type="button" className="secondary" onClick={()=>{setEditing(null);setCreating(false)}}>Cancel</button></div>
 </form>}
 <div className="panel table-panel" style={{marginTop:22}}>
 <div className="table-scroll"><table><thead><tr><th>NAME / VALUE</th><th>DETAILS</th><th>CREATED</th>{current.mode!=='read'&&<th>ACTIONS</th>}</tr></thead><tbody>
 {rows.map(row=><tr key={row.id}><td style={{fontWeight:700}}>{row.title}</td><td style={{maxWidth:400,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row.details||'—'}</td><td style={{whiteSpace:'nowrap'}}>{new Date(row.created_at).toLocaleDateString()}</td>{current.mode!=='read'&&<td><div style={{display:'flex',gap:8}}><button className="secondary" onClick={()=>edit(row)} title="Edit"><Pencil size={14}/></button>{current.mode==='crud'&&<button className="secondary" onClick={()=>void mutate('delete',row)} title="Delete"><Trash2 size={14}/></button>}</div></td>}</tr>)}
 </tbody></table></div>{!loading&&rows.length===0&&<p style={{padding:25,color:'#8c8e9b'}}>No records yet. {current.mode==='read'?'This collection is read-only.':'You can create the first entry above.'}</p>}{loading&&<p style={{padding:25}}>Loading…</p>}
 </div></section></div></div>;
}
