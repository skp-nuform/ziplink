"use client";
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
export default function Login() {
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const [visible,setVisible]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const password = String(new FormData(event.currentTarget).get('password') || '');
    try { const response = await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json','X-Shortly-Request':'1'},body:JSON.stringify({password})}); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not sign in.'); window.location.assign('/'); }
    catch(error) {setError(error instanceof Error ? error.message : 'Please try again.'); setBusy(false);}
  }
  return <form onSubmit={submit} className="signin-note"><label htmlFor="password">Your password</label><div className="password-input"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} aria-describedby={error ? 'login-error' : undefined}/><button type="button" className="icon-button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{error && <p id="login-error" role="alert" className="error-message">{error}</p>}<button className="button primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>;
}
