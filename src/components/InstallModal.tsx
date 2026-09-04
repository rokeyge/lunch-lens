import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isMobile: boolean;
}

export function InstallModal({ isOpen, onClose, deferredPrompt, isMobile }: InstallModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMac = typeof navigator !== "undefined" && /Macintosh|Mac OS X/.test(navigator.userAgent);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        onClose();
      }
    }
  };

  const handleShareClick = async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: "Lunchbox SMFC",
          text: "San Mateo–Foster City School District lunch menus for parents",
          url: window.location.href,
        });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // unavailable
      }
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="install-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="install-header">
          <img
            src={`${import.meta.env.BASE_URL}apple-touch-icon.png`}
            alt="Lunchbox icon"
            className="install-icon-img"
          />
          <div>
            <h2 id="install-modal-title">
              {isMobile ? "Add to Home Screen" : "Add to Desktop"}
            </h2>
            <p className="install-subtitle">Instant 1-tap lunch menu access</p>
          </div>
        </div>

        {deferredPrompt ? (
          <div className="install-prompt-action">
            <button
              className="install-primary-btn"
              onClick={handleInstallClick}
            >
              ⚡️ Install App Now
            </button>
          </div>
        ) : isIOS ? (
          <div className="quick-guide-box">
            <p className="quick-guide-intro">
              Apple requires saving via Safari’s Share menu:
            </p>
            <div className="quick-steps-row">
              <div className="quick-step-card">
                <span className="quick-step-icon">⎋</span>
                <strong>1. Tap Share</strong>
                <small>Bottom toolbar</small>
              </div>
              <span className="quick-step-arrow">→</span>
              <div className="quick-step-card">
                <span className="quick-step-icon">➕</span>
                <strong>2. Add to Home</strong>
                <small>Scroll down menu</small>
              </div>
            </div>
          </div>
        ) : isMobile ? (
          <div className="quick-guide-box">
            <div className="quick-steps-row">
              <div className="quick-step-card">
                <span className="quick-step-icon">⋮</span>
                <strong>1. Tap Menu</strong>
                <small>Top-right dots</small>
              </div>
              <span className="quick-step-arrow">→</span>
              <div className="quick-step-card">
                <span className="quick-step-icon">📲</span>
                <strong>2. Install App</strong>
                <small>Add to Home screen</small>
              </div>
            </div>
          </div>
        ) : (
          <div className="quick-guide-box desktop">
            {isMac ? (
              <p>
                In Mac Safari: Choose <strong>File</strong> in the top menu bar &gt; <strong>Add to Dock...</strong> to run Lunchbox as a desktop app.
              </p>
            ) : (
              <p>
                In Chrome or Edge: Click the <strong>Install icon (⊕)</strong> on the right side of the address bar.
              </p>
            )}
          </div>
        )}

        <div className="install-footer-actions">
          {canShare && (
            <button
              type="button"
              className="share-btn"
              onClick={handleShareClick}
            >
              📲 Send Link to Spouse
            </button>
          )}
          {!canShare && (
            <button
              type="button"
              className="share-btn"
              onClick={handleShareClick}
            >
              {copied ? "✓ Copied!" : "📋 Copy Link"}
            </button>
          )}
          <button
            type="button"
            className="dismiss-btn"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
