'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, Copy, Heart, Moon, Sun } from 'lucide-react';

export default function DonationView({ upiId, upiUrl, qrCode }: { upiId: string | null; upiUrl: string | null; qrCode: string | null }) {
  const [theme, setTheme] = useState('light');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('peakh-theme') === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = saved;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(saved);
    } catch {}
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('peakh-theme', next); } catch {}
  }

  async function copyUpiId() {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      setCopyError('');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch { setCopied(false); setCopyError('Copy failed. Select and copy the UPI ID above.'); }
  }

  return <div className="app donation-app">
    <header className="header donation-header">
      <Link href="/" className="logo" aria-label="peakh home">peakh<span className="logo-mark" /></Link>
      <div className="header-right"><Link href="/" className="donation-home-link mono"><ArrowLeft size={15} /> Back to app</Link><button className="theme-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={toggleTheme}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button></div>
    </header>
    <main className="main donation-main">
      <div className="donation-eyebrow mono"><span className="square" /> A note from peakh</div>
      <div className="donation-layout">
        <section className="donation-intro">
          <h1>Keep progress<br />moving<span className="orange">.</span></h1>
          <p>peakh helps you keep a record of the work you put in. If it’s useful to you, you can support its continued development.</p>
          <div className="donation-rule"><span className="mono">Built on effort</span><span className="mono">Powered by people</span></div>
        </section>
        <section className="donation-card" aria-labelledby="donation-card-title">
          <div className="donation-card-top"><span className="mono">Support peakh</span><Heart size={20} strokeWidth={1.6} aria-hidden="true" /></div>
          <div><span className="donation-card-number num" aria-hidden="true">01</span><h2 id="donation-card-title">Make a contribution.</h2><p>Send any amount in INR directly through your UPI app. Every contribution is appreciated.</p></div>
          {upiId ? <div className="donation-payment">
            {qrCode && <div className="donation-qr"><Image src={qrCode} alt="Scan this QR code with a UPI app to support peakh" width={180} height={180} unoptimized /></div>}
            <div className="donation-upi-id"><span className="mono muted">UPI ID</span><span className="donation-upi-value">{upiId}</span><button type="button" onClick={copyUpiId} aria-label={copied ? 'UPI ID copied' : 'Copy UPI ID'}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy'}</button></div>
            {copyError && <span className="error-message" role="alert">{copyError}</span>}
            {upiUrl && <a className="action-button" href={upiUrl}>Open UPI app <ArrowUpRight size={17} /></a>}
            <span className="mono muted donation-hint">On mobile, open your UPI app. On desktop, scan the QR. If the app rejects the link, copy the UPI ID and pay from inside the app. Check the recipient before paying.</span>
          </div> : <div className="donation-card-action"><div className="donation-unavailable mono" role="status">UPI contributions are being set up</div><span className="mono muted">Please check back soon</span></div>}
        </section>
      </div>
      <footer className="footer donation-footer"><span className="mono">peakh / Built on effort.</span><Link href="/" className="mono">Return to your records ↗</Link></footer>
    </main>
  </div>;
}
