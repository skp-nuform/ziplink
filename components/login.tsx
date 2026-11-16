"use client";
import { useState, type FormEvent } from 'react';
export default function Login() {
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const password = String(new FormData(event.currentTarget).get('password') || '');
    try { const response = await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json','X-Shortly-Request':'1'},body:JSON.stringify({password})}); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not sign in.'); window.location.assign('/'); }
    catch(error) {setError(error instanceof Error ? error.message : 'Please try again.'); setBusy(false);}
  }
  return <form onSubmit={submit} className="signin-note"><label htmlFor="password"><strong>Owner password</strong></label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} style={{width:'100%',padding:12,margin:'12px 0',border:'1px solid #d6dfd4',borderRadius:6}}/>{error && <p role="alert" className="error-message">{error}</p>}<button className="button primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Open my workspace'}</button></form>;
}
