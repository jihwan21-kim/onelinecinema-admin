import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Management from '@/components/management';
export const dynamic='force-dynamic';
export default async function Page(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:admin}=await supabase.rpc('cinema_is_admin');if(!admin)redirect('/');
 return <Management/>;
}
