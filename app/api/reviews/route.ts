import { createClient } from '@/lib/supabase/server';
const bad=(error:string,status:number)=>Response.json({error},{status});
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return bad('Invalid request origin.',403);
  const sb=await createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return bad('Authentication required.',401);
  const {data:isAdmin,error:accessError}=await sb.rpc('cinema_is_admin');
  if(accessError||!isAdmin)return bad('Admin access required.',403);
  let input:Record<string,unknown>;
  try{input=await request.json()}catch{return bad('Malformed JSON.',400)}
  const action=input.action;
  if(!['create','update','delete'].includes(String(action)))return bad('Invalid action.',400);
  if(action==='create'&&(!Number.isSafeInteger(input.movieId)||Number(input.movieId)<=0))return bad('Select a movie.',400);
  if(action!=='create'&& (typeof input.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.id)))return bad('Invalid review ID.',400);
  if(action!=='delete'&&(typeof input.oneLiner!=='string'||input.oneLiner.trim().length<1||input.oneLiner.trim().length>160||!['Witty','Serious','Poetic','Sarcastic'].includes(String(input.tone))))return bad('Enter a valid one-liner (1–160 characters) and tone.',400);
  const {data,error}=await sb.rpc('cinema_admin_manage_review',{
    p_action:action,p_review_id:action==='create'?null:input.id,p_movie_id:action==='create'?input.movieId:null,
    p_one_liner:action==='delete'?null:String(input.oneLiner).trim(),p_tone:action==='delete'?null:input.tone,
  });
  if(error)return bad(error.code==='42501'?'Admin access required.':error.message,error.code==='42501'?403:400);
  return Response.json({success:true,result:data});
}
