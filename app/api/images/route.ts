import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
async function authorized(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return {error:NextResponse.json({error:'Sign in required'},{status:401})};
 const {data:admin}=await supabase.rpc('cinema_is_admin');
 if(!admin)return {error:NextResponse.json({error:'Forbidden'},{status:403})};
 return {supabase};
}
export async function GET(){
 const ctx=await authorized();if(ctx.error)return ctx.error;const supabase=ctx.supabase!;
 const {data:movies,error}=await supabase.from('movies').select('id,title,poster_path').order('title').limit(500);
 if(error)return NextResponse.json({error:error.message},{status:400});
 const {data:uploaded,error:storageError}=await supabase.storage.from('movie-posters').list('admin-assets',{limit:500});
 if(storageError)return NextResponse.json({error:storageError.message},{status:400});
 const existing=(movies||[]).filter(m=>m.poster_path).map(m=>({path:m.poster_path,movieId:m.id,movie:m.title}));
 const standalone=(uploaded||[]).filter(o=>o.name&&!o.name.startsWith('.')).map(o=>({path:'admin-assets/'+o.name,movieId:null,movie:'Unassigned image'}));
 return NextResponse.json({items:[...existing,...standalone]});
}
export async function POST(request:NextRequest){
 const ctx=await authorized();if(ctx.error)return ctx.error;
 const form=await request.formData();const file=form.get('file');
 if(!(file instanceof File)||file.size===0||file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))
  return NextResponse.json({error:'Choose a JPG, PNG or WebP under 5MB'},{status:400});
 const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
 const path='admin-assets/'+crypto.randomUUID()+'.'+extension;
 const {error}=await ctx.supabase!.storage.from('movie-posters').upload(path,file,{contentType:file.type,upsert:false});
 return NextResponse.json(error?{error:error.message}:{path},{status:error?400:200});
}
export async function PATCH(request:NextRequest){
 const ctx=await authorized();if(ctx.error)return ctx.error;
 const {oldPath,newName}=await request.json().catch(()=>({}));
 if(typeof oldPath!=='string'||!oldPath.startsWith('admin-assets/')||typeof newName!=='string'||!/^[a-zA-Z0-9_-]{1,80}\.(png|jpg|webp)$/i.test(newName))
  return NextResponse.json({error:'Rename supports admin-uploaded images and safe filenames only'},{status:400});
 const path='admin-assets/'+newName;
 const {error}=await ctx.supabase!.storage.from('movie-posters').move(oldPath,path);
 return NextResponse.json(error?{error:error.message}:{path},{status:error?400:200});
}
export async function DELETE(request:NextRequest){
 const ctx=await authorized();if(ctx.error)return ctx.error;
 const {path}=await request.json().catch(()=>({}));
 if(typeof path!=='string'||(!path.startsWith('admin-assets/')&&!/^[0-9a-f-]{36}\//i.test(path))||path.includes('..'))
 return NextResponse.json({error:'Invalid image path'},{status:400});
 const supabase=ctx.supabase!;
 const {data:linked,error:lookupError}=await supabase.from('movies').select('id').eq('poster_path',path).limit(100);
 if(lookupError)return NextResponse.json({error:lookupError.message},{status:400});
 if(linked?.length){
  const {error}=await supabase.from('movies').update({poster_path:null}).eq('poster_path',path);
  if(error)return NextResponse.json({error:error.message},{status:400});
 }
 const {error}=await supabase.storage.from('movie-posters').remove([path]);
 return NextResponse.json(error?{error:error.message}:{ok:true},{status:error?400:200});
}
