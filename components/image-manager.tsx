'use client';
import {useCallback,useEffect,useState} from 'react';
type Asset={path:string;movie:string;movieId:number|null};
export default function ImageManager(){
 const [items,setItems]=useState<Asset[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[file,setFile]=useState<File|null>(null);
 const load=useCallback(async()=>{try{const res=await fetch('/api/images',{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error);setItems(data.items||[])}catch(e){setError(e instanceof Error?e.message:'Load failed')}},[]);
 useEffect(()=>{void load()},[load]);
 async function upload(){if(!file)return;setBusy(true);setError('');try{const form=new FormData();form.append('file',file);const res=await fetch('/api/images',{method:'POST',body:form});const data=await res.json();if(!res.ok)throw Error(data.error);setFile(null);await load()}catch(e){setError(e instanceof Error?e.message:'Upload failed')}finally{setBusy(false)}}
 async function action(method:'PATCH'|'DELETE',item:Asset){let body:Record<string,string>={path:item.path};
 if(method==='PATCH'){const newName=window.prompt('New filename (jpg, png, or webp)',item.path.split('/').pop());if(!newName)return;body={oldPath:item.path,newName}}
 else if(!window.confirm('Delete this image permanently? Linked movie posters will be cleared.'))return;
 setBusy(true);setError('');try{const r=await fetch('/api/images',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);await load()}catch(e){setError(e instanceof Error?e.message:'Action failed')}finally{setBusy(false)}
 }
 return <section><div className="panel" style={{padding:18,marginBottom:18,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/><button className="primary" disabled={!file||busy} onClick={()=>void upload()}>Upload new image</button><button className="secondary" onClick={()=>void load()}>Refresh</button></div>
 {error&&<p role="alert" className="form-error">{error}</p>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:14}}>{items.map((item,i)=><article key={item.path+'-'+i} className="panel" style={{padding:15}}>
 <img alt={item.movie} src={'https://npeoapvqpkpeistlyqto.supabase.co/storage/v1/object/public/movie-posters/'+item.path.split('/').map(encodeURIComponent).join('/')} style={{width:'100%',height:175,objectFit:'contain',borderRadius:7,background:'#f5f5f8'}}/>
 <p style={{fontWeight:700,fontSize:13}}>{item.movie}</p><p style={{fontSize:10,overflowWrap:'anywhere',color:'#8a8a9a'}}>{item.path}</p>
 <div style={{display:'flex',gap:8}}>{item.path.startsWith('admin-assets/')&&<button className="secondary" disabled={busy} onClick={()=>void action('PATCH',item)}>Rename</button>}<button className="secondary" disabled={busy} onClick={()=>void action('DELETE',item)}>Delete</button></div></article>)}</div>
 {!items.length&&<p>No images found.</p>}</section>
}
