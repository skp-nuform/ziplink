"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, CircleHelp, Copy, ExternalLink, Link2, Loader2, Monitor, MoreHorizontal, Pause, Pencil, Play, Plus, QrCode, RefreshCw, Search, Share2, ShieldCheck, Trash2, X } from "lucide-react";
import QRCode from "qrcode";
import { linkPath } from "@/lib/link-address";
import { emptyRecentLinks, forgetLink, readRecentLinks, recentLinksKey, rememberLink, type RecentLink, type RecentLinks } from "@/lib/recent-links";

type LinkRecord = { slug: string; destination: string; title: string; createdAt: number; clicks: number; active: number };
type ModalState = { type: "help" } | { type: "qr" | "edit" | "delete" | "actions"; link: LinkRecord } | null;
function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const headingId = useId();
  useEffect(() => { const d = ref.current; const previous = document.activeElement as HTMLElement | null; d?.showModal(); return () => { d?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={headingId} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === ref.current) close(); }}><div className="modal-head"><h2 id={headingId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button></div>{children}</dialog>;
}
function QRPanel({ link, url, local }: { link: LinkRecord; url: string; local: boolean }) {
  const [image, setImage] = useState(""); const [error, setError] = useState("");
  useEffect(() => { QRCode.toDataURL(url, { width: 600, margin: 3, errorCorrectionLevel: "M", color: { dark: "#173d31", light: "#ffffff" } }).then(setImage).catch(() => setError("Couldn't create the QR code. Please reopen this window.")); }, [url]);
  return <div className="qr-panel">{image ? <img width={232} height={232} src={image} alt={`QR code for ${link.title}`}/> : <p>{error || "Creating your QR code…"}</p>}<strong>{link.title}</strong><code>{url}</code><div className="info-note"><Monitor size={17}/><span>{local ? "This code points to your local prototype. Scanning from a phone will work once the app is hosted online." : "Scan this code on any device to open the destination."}</span></div>{image && <a className="button primary wide" href={image} download={`shortly-${link.slug}.png`}><ArrowDownToLine size={17}/> Download PNG</a>}</div>;
}
export default function Dashboard({ local, owner }: { local: boolean; owner: boolean }) {
  const [view, setView] = useState("create");
  const [options, setOptions] = useState(false);
  const [copied, setCopied] = useState(""); const [canShare, setCanShare] = useState(false);
  const resultRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setCanShare(typeof navigator.share === "function"); }, []);

  useEffect(() => { const sync = () => { const hash = window.location.hash; if (owner && hash === "#links") setView("links"); else if (!hash || hash === "#create") setView("create"); }; sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, [owner]);
  function navigate(next: string) { setView(next); window.location.hash = next; window.scrollTo({ top: 0 }); }
  const [links, setLinks] = useState<LinkRecord[]>([]); const [loaded, setLoaded] = useState(false); const [loadError, setLoadError] = useState(""); const [loading, setLoading] = useState(false); const [hasLoadedLinks, setHasLoadedLinks] = useState(false); const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState(""); const [title, setTitle] = useState(""); const [slug, setSlug] = useState(""); const [formError, setFormError] = useState(""); const [busy, setBusy] = useState(""); const [result, setResult] = useState<LinkRecord | null>(null);
  const [recent, setRecent] = useState<RecentLinks>(emptyRecentLinks);
  const recentRef = useRef<RecentLinks>(emptyRecentLinks());
  const [historyReady, setHistoryReady] = useState(false); const [historyError, setHistoryError] = useState("");
  const [actionError, setActionError] = useState("");
  const actionErrorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (actionError) actionErrorRef.current?.focus(); }, [actionError]);
  useEffect(() => {
    if (owner) return;
    try {
      const saved = readRecentLinks(window.localStorage.getItem(recentLinksKey));
      recentRef.current = saved; setRecent(saved);
      const selected = saved.links.find(link => link.slug === saved.selectedSlug);
      if (selected) setResult({ ...selected, clicks: 0, active: 1 });
    } catch { setHistoryError("This browser cannot save your recent links. Copy or download each link before leaving."); }
    setHistoryReady(true);
  }, [owner]);
  function saveRecent(next: RecentLinks, keepInMemory = true) {
    try {
      window.localStorage.setItem(recentLinksKey, JSON.stringify(next));
      recentRef.current = next; setRecent(next); setHistoryError(""); return true;
    } catch {
      if (keepInMemory) { recentRef.current = next; setRecent(next); }
      setHistoryError(keepInMemory ? "Your link works, but this browser could not save the recent list. Copy or download it before leaving." : "The recent list could not be removed from this browser. Try again or clear this site's browser data.");
      return false;
    }
  }
  function keepRecent(link: LinkRecord) {
    if (owner) return;
    let saved = recentRef.current;
    try { const stored = readRecentLinks(window.localStorage.getItem(recentLinksKey)); saved = historyError ? { ...saved, links: [...saved.links, ...stored.links] } : stored; } catch {}
    saveRecent(rememberLink(saved, link));
  }
  function restoreRecent(link: RecentLink) {
    setResult({ ...link, clicks: 0, active: 1 }); setCopied(""); setActionError("");
    saveRecent({ ...recentRef.current, selectedSlug: link.slug });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({block:"start"}));
  }
  function removeRecent(slug?: string) {
    const next = slug ? forgetLink(recentRef.current, slug) : emptyRecentLinks();
    if (saveRecent(next, false)) {
      if (!slug || result?.slug === slug) setResult(null);
      tell("Removed from this browser only. The shared link still works.");
    }
  }
  function downloadLink(link: LinkRecord) {
    const blob = new Blob([shortUrl(link) + "\n" + link.destination + "\n"], {type:"text/plain"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download=`shortly-${link.slug}.txt`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all"); const [sort, setSort] = useState("newest"); const [modal, setModal] = useState<ModalState>(null); const [editTitle, setEditTitle] = useState(""); const [editDestination, setEditDestination] = useState(""); const [modalError, setModalError] = useState(""); const [toast, setToast] = useState("");
  const urlRef = useRef<HTMLInputElement>(null); const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tell = useCallback((message: string) => { setActionError(""); if (toastTimer.current) clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(""), 3500); }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch("/api/links", { cache: "no-store" }); const data = await response.json() as { error?: string; links: LinkRecord[]; link: LinkRecord }; if (!response.ok) throw new Error(data.error || "Couldn't load your links."); setLinks(data.links); setHasLoadedLinks(true); setLoadError(""); } catch (e) { setLoadError(e instanceof Error ? e.message : "Couldn’t load your links. Check your connection and retry."); } finally { setLoaded(true); setLoading(false); } }, []);
  useEffect(() => { setOrigin(window.location.origin); if (!owner) { setLoaded(true); return; } load(); const refresh = () => { if (document.visibilityState === "visible") load(); }; window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); }; }, [load, owner]);
  const shortUrl = (item: LinkRecord) => `${origin}${linkPath(item.slug)}`;
  async function mutate(path: string, method: string, payload?: unknown) { const response = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-Shortly-Request": "1" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }); const data = await response.json() as { error?: string; links: LinkRecord[]; link: LinkRecord }; if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again."); return data; }
  async function createLink(e: FormEvent) { e.preventDefault(); setBusy("create"); setFormError(""); setActionError(""); try { const data = await mutate("/api/links", "POST", { destination: destination.trim(), title: title.trim(), slug: slug.trim() }); setLinks(previous => [data.link, ...previous]); setCopied(""); setResult(data.link); keepRecent(data.link); setDestination(""); setTitle(""); setSlug(""); tell("Your short link is ready."); } catch (e) { setFormError(e instanceof Error ? e.message : "Couldn't create your link."); } finally { setBusy(""); } }
  async function copy(link: LinkRecord) { try { await navigator.clipboard.writeText(shortUrl(link)); setCopied(link.slug); tell("Short link copied."); } catch { setCopied(""); setToast(""); setActionError("Copy failed. Open the saved link, select its address, and copy it manually, or download it."); } }
  async function share(link: LinkRecord) { try { await navigator.share({title: link.title, url: shortUrl(link)}); } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) { setToast(""); setActionError("Sharing is unavailable. Use Copy link or Download link instead."); } } }
  const activeCount = links.filter(l => l.active).length; const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const visibleLinks = useMemo(() => { const term = search.toLowerCase().trim(); return links.filter(l => (filter === "all" || (filter === "active" ? l.active : !l.active)) && `${l.title} ${l.destination} ${l.slug}`.toLowerCase().includes(term)).sort((a, b) => sort === "clicks" ? b.clicks - a.clicks || b.createdAt - a.createdAt : b.createdAt - a.createdAt); }, [links, search, filter, sort]);
  function newLink() { navigate("create"); setResult(null); setCopied(""); setActionError(""); if (!owner) saveRecent({ ...recentRef.current, selectedSlug: null }); requestAnimationFrame(() => urlRef.current?.focus()); }
  function openModal(type: "edit" | "qr" | "delete" | "actions", link: LinkRecord) { setModalError(""); setEditTitle(link.title); setEditDestination(link.destination); setModal({ type, link }); }
  function closeModal() { if (!busy) { setModal(null); setModalError(""); } }
  async function saveEdit(e: FormEvent) { e.preventDefault(); if (modal?.type !== "edit") return; setBusy("edit"); setModalError(""); try { const data = await mutate(`/api/links/${modal.link.slug}`, "PATCH", { title: editTitle, destination: editDestination }); setLinks(previous => previous.map(l => l.slug === data.link.slug ? data.link : l)); if (result?.slug === data.link.slug) setResult(data.link); setModal(null); tell("Link updated. Your short address stays the same."); } catch (e) { setModalError(e instanceof Error ? e.message : "Couldn't update this link."); } finally { setBusy(""); } }
  async function toggle(link: LinkRecord) { setBusy(link.slug); try { const data = await mutate(`/api/links/${link.slug}`, "PATCH", { active: !link.active }); setLinks(previous => previous.map(l => l.slug === link.slug ? data.link : l)); if (result?.slug === link.slug) setResult(data.link); tell(link.active ? "Link paused. It won't redirect until you resume it." : "Link is active again."); } catch (e) { setToast(""); setActionError((e instanceof Error ? e.message : "Couldn't update this link.") + " Open Link options and try again."); } finally { setBusy(""); } }
  async function remove() { if (modal?.type !== "delete") return; setBusy("delete"); setModalError(""); try { await mutate(`/api/links/${modal.link.slug}`, "DELETE"); setLinks(previous => previous.filter(l => l.slug !== modal.link.slug)); if (result?.slug === modal.link.slug) setResult(null); setModal(null); tell("Link deleted."); } catch (e) { setModalError(e instanceof Error ? e.message : "Couldn't delete this link."); } finally { setBusy(""); } }
  function exportLinks() { const blob = new Blob([JSON.stringify({ app: "Shortly", exportedAt: new Date().toISOString(), links }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `shortly-links-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); tell("Your links have been exported."); }

  return <div className={"app-shell" + (!owner ? " guest-mode" : "")}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><div className="header-inner">
      <a className="brand" href="#create" aria-label="Shortly home" onClick={() => navigate("create")}><span className="brand-mark"><Link2 size={22}/></span>shortly<span className="brand-dot">.</span></a>
      {owner && <nav className="main-nav" aria-label="Main navigation">
        <a href="#create" className={view === "create" ? "selected" : ""} aria-current={view === "create" ? "page" : undefined} onClick={() => navigate("create")}><Plus size={18}/> Shorten a link</a>
        <a href="#links" className={view === "links" ? "selected" : ""} aria-current={view === "links" ? "page" : undefined} onClick={() => navigate("links")}><Link2 size={18}/> My links</a>
      </nav>}
      <div className="header-actions"><button className="icon-button" aria-label="Help" onClick={() => setModal({ type: "help" })}><CircleHelp size={20}/></button>{owner ? <>{!local && <a className="signout-link" href="/logout">Sign out</a>}<span className="owner-avatar" aria-label="Personal workspace">S</span></> : <span className="guest-label">Free link shortener</span>}</div>
    </div></header>
    {actionError && <div ref={actionErrorRef} tabIndex={-1} className="action-error" role="alert"><AlertCircle size={20}/><p>{actionError}</p><button className="icon-button" aria-label="Dismiss error" onClick={()=>setActionError("")}><X size={18}/></button></div>}
    <main id="main-content" className={view === "create" ? "create-page" : "library-page"}>
      {view === "create" ? <>
        <div className="create-intro"><span className="eyebrow"><span/> SMALL LINK. BIG POSSIBILITIES.</span><h1>Less link.<br/><span>More sharing.</span></h1><p>Turn a long address into a little link.<br className="desktop-break"/> Ready for wherever life takes it.</p><div className="intro-proof"><Check size={16}/> Free to use <span>·</span> No account needed</div><div className="link-illustration" aria-hidden="true"><span className="illustration-label">A LITTLE LESS OF THIS</span><div className="sample-long">example.com/something/really/long…</div><ArrowDownToLine size={20}/><div className="sample-short"><Link2 size={19}/> shortly<span>/hello</span><ArrowUpRight size={18}/></div><span className="illustration-caption">One small link. Anywhere you want to go.</span></div></div>
        <div className="composer-group"><section className="composer" aria-label="Shorten a link">
          {!result ? <form onSubmit={createLink}>
            <div className="composer-heading"><span className="composer-icon"><Link2 size={23}/></span><h2>Make it short.</h2><p>Your next share starts here.</p></div><label htmlFor="destination">Where should your link go?</label>
            <div className="url-input-wrap"><Link2 size={20}/><input ref={urlRef} id="destination" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://example.com/your-long-link" value={destination} onChange={e => setDestination(e.target.value)} required maxLength={4096} disabled={busy === "create"} aria-describedby={formError ? "create-error" : "url-hint"}/></div>
            <p className="field-hint" id="url-hint">Use a full link, starting with https://</p>
            <button type="button" className="options-toggle" aria-expanded={options} aria-controls="link-options" onClick={() => setOptions(!options)}><Plus size={16} className={options ? "rotated" : ""}/> Customize <span>Optional</span></button>
            {options && <div className="form-row" id="link-options"><div><label htmlFor="title">Title</label><input id="title" placeholder="e.g. My portfolio" value={title} onChange={e => setTitle(e.target.value)} maxLength={100}/></div><div><label htmlFor="slug">Custom ending</label><div className="slug-input"><span>/</span><input id="slug" placeholder="my-portfolio" value={slug} onChange={e => setSlug(e.target.value)} maxLength={40} autoCapitalize="none" autoCorrect="off" spellCheck={false}/></div></div></div>}
            {formError && <p id="create-error" role="alert" className="error-message">{formError}</p>}
            <button className="button primary wide create-submit" type="submit" disabled={!!busy}>{busy === "create" ? <><Loader2 size={18} className="spin"/> Shortening…</> : <>Shorten link <ArrowRight size={18}/></>}</button>
          </form> : <div className="result-panel" aria-label="Created short link"><span className="success-icon"><Check size={24}/></span><h2 ref={resultRef} tabIndex={-1}>Your link is ready.</h2><p>Copy it. Send it. Make someone’s day.</p><label className="result-label" htmlFor="created-link">Your short link</label><div className="result-address"><input id="created-link" readOnly value={shortUrl(result)} onFocus={e=>e.target.select()}/><a href={shortUrl(result)} target="_blank" rel="noreferrer" className="icon-button" aria-label="Open short link"><ArrowUpRight size={20}/></a></div><p className="result-destination">Goes to <span title={result.destination}>{result.destination}</span></p><button className="button primary wide" onClick={() => copy(result)}>{copied===result.slug?<Check size={18}/>:<Copy size={18}/>} {copied===result.slug?'Copied!':'Copy link'}</button>{canShare&&<button className="button outline wide native-share" onClick={()=>share(result)}><Share2 size={18}/> Share link</button>}<p className="result-retention">{owner ? "Saved in My links." : historyError ? "Copy or download this link now so you can find it later." : "Saved in Recent links on this device. Only the owner can edit or delete it."}</p><div className="result-actions"><button className="text-button" onClick={() => openModal("qr", result)}><QrCode size={17}/> QR code</button><button className="text-button" onClick={newLink}><Plus size={17}/> Shorten another</button><button className="text-button" onClick={()=>downloadLink(result)}><ArrowDownToLine size={17}/> Download link</button></div></div>}
        </section>
        <p className="privacy-line"><ShieldCheck size={15}/>{owner ? (local ? "Saved on this device." : "Your links are saved in My links.") : "Create and share without an account."}</p>
        {!owner && historyReady && <div className="recent-section">
          {historyError && <p className="error-message history-error" role="alert"><AlertCircle size={17}/>{historyError}</p>}
          <details className="recent-links"><summary>Recent links on this device <span>{recent.links.length}</span><ChevronDown size={18} aria-hidden="true"/></summary>
            <p className="history-description">The last 20 links you create here stay in this browser. This list is not synced and disappears if browser data is cleared. Anyone using this browser can see it.</p>
            {recent.links.length ? <><ul>{recent.links.map(link=><li key={link.slug}><button className="recent-title" onClick={()=>restoreRecent(link)}><strong>{link.title}</strong><span>{shortUrl({...link,clicks:0,active:1}).replace(/^https?:\/\//, "")}</span></button><div className="recent-actions"><button className="icon-button" aria-label={"Copy recent link " + link.title} onClick={()=>copy({...link,clicks:0,active:1})}><Copy size={17}/></button><button className="icon-button" aria-label={"QR code for " + link.title} onClick={()=>openModal("qr",{...link,clicks:0,active:1})}><QrCode size={17}/></button><button className="icon-button" aria-label={"Remove " + link.title + " from this browser"} onClick={()=>removeRecent(link.slug)}><X size={17}/></button></div></li>)}</ul><p className="history-description">Removing items here does not delete the shared links.</p><button className="text-button" onClick={()=>removeRecent()}>Clear this device’s recent list</button></> : <p className="history-description">Links you create in this browser will appear here.</p>}
          </details>
        </div>}
        {owner && <a className="library-shortcut" href="#links" onClick={() => navigate("links")}>Looking for a saved link? <span>Go to My links <ArrowRight size={15}/></span></a>}
</div>
      </> : <>
        <header className="library-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>My links</h1><p>Everything you’ve shared, in one place.</p></div><button className="button primary" onClick={newLink}><Plus size={18}/> New link</button></header>
        <section className="stats" aria-label="Link statistics"><div><span>Total links</span><strong>{hasLoadedLinks ? links.length.toLocaleString() : loadError ? "Unavailable" : "—"}</strong></div><div><span>Total clicks</span><strong>{hasLoadedLinks ? totalClicks.toLocaleString() : loadError ? "Unavailable" : "—"}</strong></div><div><span>Active links</span><strong>{hasLoadedLinks ? activeCount.toLocaleString() : loadError ? "Unavailable" : "—"}</strong></div></section>
        {loadError && <div className="error-banner" role="alert"><span>{hasLoadedLinks ? "Couldn’t refresh your links. Showing the last loaded data. " : ""}{loadError}</span><button onClick={load} disabled={loading}>{loading ? "Retrying…" : "Retry"}</button></div>}
        {hasLoadedLinks && <><div className="links-toolbar"><div className="search-input"><Search size={19}/><input aria-label="Search your links" placeholder="Search your links" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="toolbar-actions"><select aria-label="Sort links" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="clicks">Most clicked</option></select><button className="icon-button" onClick={load} disabled={loading} aria-label="Refresh link statistics"><RefreshCw className={loading ? "spin" : undefined} size={18}/></button><button className="icon-button" onClick={exportLinks} disabled={!links.length || !!loadError} aria-label="Export links"><ArrowDownToLine size={18}/></button></div></div>
        <div className="filter-tabs" role="group" aria-label="Filter links">{["all", "active", "paused"].map(f => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)} aria-pressed={filter === f}>{f === "all" ? "All links" : f === "active" ? "Active" : "Paused"}</button>)}</div></>}
        <section className="link-list" aria-label="Saved links">
          {!hasLoadedLinks && (loading || !loaded) ? <div className="empty-state"><Loader2 className="spin"/><h2>Loading your links…</h2></div> : !hasLoadedLinks ? <div className="empty-state load-failure"><AlertCircle size={32}/><h2>Your links could not be loaded</h2><p>Your saved links have not been removed. Use Retry above to load them.</p></div> : !visibleLinks.length ? <div className="empty-state"><Link2 size={32}/><h2>{links.length ? "No matching links" : "Your links will live here"}</h2><p>{links.length ? "Try another search or filter." : "Create your first short link to get started."}</p><button className="button outline" onClick={links.length ? () => { setSearch(""); setFilter("all"); } : newLink}>{links.length ? "Clear filters" : "Create a link"}</button></div> : visibleLinks.map(link => <article key={link.slug} className="link-row"><span className="link-avatar"><Link2 size={20}/></span><div className="link-details"><h2>{link.title}</h2><a className="short-address" href={shortUrl(link)} target="_blank" rel="noreferrer">{shortUrl(link).replace(/^https?:\/\//, "")}<ArrowUpRight size={14}/></a><p className="destination" title={link.destination}>{link.destination}</p><div className="link-meta"><span className={"status " + (link.active ? "active" : "paused")}><i/>{link.active ? "Active" : "Paused"}</span><span><BarChart3 size={14}/>{link.clicks.toLocaleString()} clicks</span><time dateTime={new Date(link.createdAt).toISOString()}>{new Date(link.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div></div><div className="row-actions"><button className="icon-button" aria-label={"Copy " + link.title} onClick={() => copy(link)}><Copy size={18}/></button><button className="icon-button" aria-label={"More actions for " + link.title} onClick={()=>openModal("actions",link)}><MoreHorizontal size={20}/></button></div></article>)}
        </section>{hasLoadedLinks && <div className="table-footer">{visibleLinks.length} {visibleLinks.length === 1 ? "link" : "links"}<span>{loadError ? "Last loaded data. Retry to update." : "Repeat visits count as clicks."}</span></div>}
      </>}
    </main>
  {!owner&&<footer className="public-footer"><span>A little link goes a long way.</span><a href="/login">Owner sign-in <ArrowUpRight size={14}/></a></footer>}
  <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite" aria-atomic="true">{toast && <><Check size={17}/>{toast}</>}</div>
  {modal?.type === "actions" && <Modal title="Link options" close={closeModal}><div className="link-options-menu"><p>{modal.link.title}</p><button onClick={()=>{copy(modal.link);setModal(null);}}><Copy size={19}/> Copy short link</button><button onClick={()=>openModal("qr",modal.link)}><QrCode size={19}/> QR code</button><button onClick={()=>openModal("edit",modal.link)}><Pencil size={19}/> Edit link</button><button disabled={!!busy} onClick={()=>{toggle(modal.link);setModal(null);}}>{modal.link.active?<Pause size={19}/>:<Play size={19}/>} {modal.link.active?'Pause link':'Resume link'}</button><a href={shortUrl(modal.link)} target="_blank" rel="noreferrer"><ExternalLink size={19}/> Open link</a><button className="danger-text" onClick={()=>openModal("delete",modal.link)}><Trash2 size={19}/> Delete link</button></div></Modal>}
  {modal?.type === "qr" && <Modal title="A shortcut you can scan." close={closeModal}><QRPanel link={modal.link} url={shortUrl(modal.link)} local={local}/></Modal>}
  {modal?.type === "edit" && <Modal title="Edit your link" close={closeModal}><form onSubmit={saveEdit} className="modal-form"><p>Your short address stays the same. Only its destination or title changes.</p><label htmlFor="edit-title">Link title</label><input id="edit-title" value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={100}/><label htmlFor="edit-url">Destination URL</label><input id="edit-url" type="url" value={editDestination} onChange={e => setEditDestination(e.target.value)} required maxLength={4096}/>{modalError && <p className="error-message" role="alert">{modalError}</p>}<div className="modal-actions"><button className="button outline" type="button" onClick={closeModal} disabled={!!busy}>Cancel</button><button className="button primary" disabled={!!busy}>{busy ? "Saving…" : "Save changes"}</button></div></form></Modal>}
  {modal?.type === "delete" && <Modal title="Delete this link?" close={closeModal}><div className="modal-form"><p><strong>{modal.link.title}</strong> and its click count will be removed. The short address will stop working. This cannot be undone.</p>{modalError && <p className="error-message" role="alert">{modalError}</p>}<div className="modal-actions"><button className="button outline" onClick={closeModal} disabled={!!busy}>Keep link</button><button className="button danger" onClick={remove} disabled={!!busy}>{busy ? "Deleting…" : "Delete link"}</button></div></div></Modal>}
  {modal?.type === "help" && <Modal title="A quick guide" close={closeModal}><div className="help-content"><ol><li><strong>Paste a destination</strong><p>Use a full address beginning with https:// or http://. Add a title or a custom ending if you like.</p></li><li><strong>Create, copy, and try it</strong><p>Open your new short link in {local ? "another browser tab on this computer" : "a browser on any device"}. It takes you to the original page.</p></li><li><strong>See what happens</strong><p>Find links you create in Recent links on this device, or download a copy. Clearing browser data removes this recent list. Only the owner can manage saved links from My links.</p></li></ol><div className="info-note"><Monitor size={20}/><div><strong>{local ? "This is a local prototype." : "Your links are online."}</strong><p>{local ? "Keep the local server running to use your links. They are saved on disk and survive a restart. They will work on other devices once hosted online." : "Anyone with a short link can open it without signing in. Only the owner can manage links. Your links stay available when your computer is off."}</p></div></div><p className="help-fineprint">{local ? "This is a single personal workspace. Local and online versions have separate databases." : "Anyone can create a short link without signing in. Only the owner can view all saved links or edit and delete them. Guests can reopen the recent list saved in their own browser."} QR codes are generated in your browser.</p><button className="button primary wide" onClick={closeModal}>Got it <ArrowRight size={17}/></button></div></Modal>}
  </div>;
}
