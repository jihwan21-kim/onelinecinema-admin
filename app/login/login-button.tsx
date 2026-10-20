'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export function LoginButton(){
 const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 async function login(){setBusy(true);setError('');const {error}=await createClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback`}});if(error){setError(error.message);setBusy(false);}}
 return <><button className="primary login-google" onClick={login} disabled={busy}><span className="google-g">G</span>{busy?'Redirecting to Google…':'Continue with Google'}</button>{error&&<p className="error-text">{error}</p>}</>;
}
