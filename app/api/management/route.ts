import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const collections: Record<string,{table:string;mode:'read'|'update'|'crud'}> = {
 chains:{table:'cinema_prompt_chains',mode:'read'},
 steps:{table:'cinema_prompt_chain_steps',mode:'read'},
 mix:{table:'cinema_prompt_chain_mix',mode:'update'},
 terms:{table:'cinema_terms',mode:'crud'},
 requests:{table:'cinema_generation_requests',mode:'read'},
 examples:{table:'cinema_generation_examples',mode:'crud'},
 models:{table:'cinema_llm_models',mode:'crud'},
 providers:{table:'cinema_llm_providers',mode:'crud'},
 responses:{table:'cinema_llm_responses',mode:'read'},
 domains:{table:'cinema_allowed_signup_domains',mode:'crud'},
 emails:{table:'cinema_whitelisted_emails',mode:'crud'},
};
async function context(key:string){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return {error:NextResponse.json({error:'Sign in required'},{status:401})};
 const {data:admin,error:roleError}=await supabase.rpc('cinema_is_admin');
 if(roleError||!admin)return {error:NextResponse.json({error:'Administrator permission required'},{status:403})};
 const config=collections[key];
 if(!config)return {error:NextResponse.json({error:'Unknown collection'},{status:400})};
 return {supabase,config};
}
export async function GET(request:NextRequest){
 const key=request.nextUrl.searchParams.get('type')||'';
 if(key==='media'||key==='requests'||key==='responses'){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const {data,error}=await supabase.rpc('cinema_admin_generation_records',{p_kind:key});
 return NextResponse.json(error?{error:error.message}:{rows:data},{status:error?403:200});
}
if(key==='images'){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const {data:admin}=await supabase.rpc('cinema_is_admin');if(!admin)return NextResponse.json({error:'Forbidden'},{status:403});
 const {data,error}=await supabase.from('movies').select('id,title,poster_path,created_at').order('created_at',{ascending:false}).limit(500);
 return NextResponse.json(error?{error:error.message}:{rows:(data||[]).map(x=>({id:String(x.id),title:x.title,details:x.poster_path||'No poster',created_at:x.created_at}))},{status:error?500:200});
}
 const ctx=await context(key);if(ctx.error)return ctx.error;
 const {data,error}=await ctx.supabase!.from(ctx.config!.table).select('*').order('created_at',{ascending:false}).limit(500);
 return NextResponse.json(error?{error:error.message}:{rows:data},{status:error?500:200});
}
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid JSON'},{status:400});
 const key=String(body.type||'');const ctx=await context(key);if(ctx.error)return ctx.error;
 const config=ctx.config!;const action=body.action;
 if((action==='create'||action==='delete')&&config.mode!=='crud')return NextResponse.json({error:'Read-only collection'},{status:403});
 if(action==='update'&&config.mode==='read')return NextResponse.json({error:'Read-only collection'},{status:403});
 const title=typeof body.title==='string'?body.title.trim():'';
 const details=typeof body.details==='string'?body.details.slice(0,10000):'';
 const id=typeof body.id==='string'?body.id:'';
 const weight=Number(body.weight);
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(action!=='delete'&&(!title||title.length>200))return NextResponse.json({error:'Title required (maximum 200 characters)'},{status:400});
 if(action!=='create'&&!uuid.test(id))return NextResponse.json({error:'Valid ID required'},{status:400});
 const supabase=ctx.supabase!;let result;
 if(action==='create')result=await supabase.from(config.table).insert({title,details}).select().single();
 else if(action==='update'){
  if(key==='mix'&&(!Number.isInteger(weight)||weight<0||weight>100))return NextResponse.json({error:'Mix weight must be an integer between 0 and 100'},{status:400});
  result=await supabase.from(config.table).update(key==='mix'?{title,details,weight}:{title,details}).eq('id',id).select().single();
 }
 else if(action==='delete')result=await supabase.from(config.table).delete().eq('id',id).select().single();
 else return NextResponse.json({error:'Unknown action'},{status:400});
 return NextResponse.json(result.error?{error:result.error.message}:{row:result.data},{status:result.error?400:200});
}
