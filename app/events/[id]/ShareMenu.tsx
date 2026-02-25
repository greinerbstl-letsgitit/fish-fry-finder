"use client";

import { useEffect, useMemo, useState } from "react";

export default function ShareMenu({ locationName }: { locationName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    const fallbackUrl = window.location.href;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!baseUrl) {
      setCurrentUrl(fallbackUrl);
      return;
    }
    try {
      const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const absoluteUrl = new URL(path, baseUrl).toString();
      setCurrentUrl(absoluteUrl);
    } catch {
      setCurrentUrl(fallbackUrl);
    }
  }, []);

  const facebookUrl = useMemo(() => {
    if (!currentUrl) return "#";
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`;
  }, [currentUrl]);

  const smsUrl = useMemo(() => {
    if (!currentUrl) return "#";
    const message = `Check out this fish fry at ${locationName}! Order online here: ${currentUrl}`;
    return `sms:?&body=${encodeURIComponent(message)}`;
  }, [currentUrl, locationName]);

  async function handleCopyLink() {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setOpen(false);
    } catch {
      // No-op if clipboard permissions are unavailable.
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg active:bg-[#b8941f]"
      >
        Share
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[#2d5a87] bg-white shadow-lg">
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="block px-4 py-3 text-sm font-medium text-[#1e3a5f] hover:bg-gray-50"
          >
            Share to Facebook
          </a>
          <a
            href={smsUrl}
            className="block border-t border-gray-100 px-4 py-3 text-sm font-medium text-[#1e3a5f] hover:bg-gray-50"
          >
            Share via Text Message
          </a>
          <button
            type="button"
            onClick={handleCopyLink}
            className="block w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-medium text-[#1e3a5f] hover:bg-gray-50"
          >
            Copy Link
          </button>
        </div>
      )}
      {copied && (
        <p className="absolute right-0 mt-2 rounded-md bg-[#16324a] px-3 py-1.5 text-xs font-medium text-amber-200 shadow">
          Link copied!
        </p>
      )}
    </div>
  );
}
