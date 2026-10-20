import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard';
import { Snapshot } from '@/lib/types';
export const dynamic='force-dynamic';
export default async function Home(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:allowed,error:roleError}=await supabase.rpc('cinema_is_admin');
  if(roleError||!allowed)return <div className="access-page"><div className="access-panel"><div className="lock-emoji">🔒</div><p className="eyebrow">ACCOUNT RESTRICTED</p><h1>Access requires approval.</h1><p>Your Google account is signed in, but it is not on the administrator allowlist. Ask the project owner to grant access in Supabase.</p><div className="user-email">{user.email}</div><form action="/auth/signout" method="post"><button className="secondary">Sign out</button></form></div></div>;
  const {data,error}=await supabase.rpc('cinema_admin_snapshot');
  if(error||!data)return <div className="access-page"><div className="access-panel"><h1>Unable to load dashboard</h1><p>Check whether <code>supabase/admin_panel.sql</code> was applied to the original project.</p><form action="/auth/signout" method="post"><button className="secondary">Sign out</button></form></div></div>;
  return <Dashboard initial={data as Snapshot} email={user.email??''}/>;
}
