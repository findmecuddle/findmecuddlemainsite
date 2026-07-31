"use client";

import { useState } from "react";

/** Small "Copy Caption" button for the admin "Ready To Post" queue — copies the exact caption text. */
export default function CopyCaptionButton({ caption }: { caption: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the caption text is still
      // visible and manually selectable, so this isn't a dead end, just a lost shortcut.
    }
  }

  return (
    <button type="button" onClick={copy} className="btn-ghost text-sm">
      {copied ? "Copied!" : "Copy Caption"}
    </button>
  );
}
