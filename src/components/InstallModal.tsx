import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
}

export function InstallModal({ isOpen, onClose, deferredPrompt }: InstallModalProps) {
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
        // User cancelled or share failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // clipboard unavailable
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
          aria-label="Close add to home screen instructions"
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
            <h2 id="install-modal-title">Add Lunchbox to Phone</h2>
            <p className="install-subtitle">Fast 1-tap access with no App Store needed</p>
          </div>
        </div>

        <p className="install-benefit">
          Save this page to your home screen to check daily school lunches without typing or searching. Your selected school stays saved!
        </p>

        {deferredPrompt ? (
          <div className="install-prompt-action">
            <button
              className="install-primary-btn"
              onClick={handleInstallClick}
            >
              Install App on Phone
            </button>
            <p className="install-note">Tapping install adds the Lunchbox app directly to your home screen.</p>
          </div>
        ) : isIOS ? (
          <div className="install-steps">
            <h3>How to save on iPhone & iPad:</h3>
            <ol>
              <li>
                <span className="step-num">1</span>
                <span>
                  Tap the <strong>Share</strong> button{" "}
                  <span className="step-glyph" title="Share icon">⎋</span>{" "}
                  at the bottom of Safari.
                </span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span>
                  Scroll down the menu and tap{" "}
                  <strong>Add to Home Screen</strong>{" "}
                  <span className="step-glyph" title="Plus icon">➕</span>.
                </span>
              </li>
              <li>
                <span className="step-num">3</span>
                <span>
                  Tap <strong>Add</strong> in the top-right corner.
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="install-steps">
            <h3>How to save shortcut:</h3>
            <ol>
              <li>
                <span className="step-num">1</span>
                <span>
                  Tap the browser menu{" "}
                  <strong>⋮</strong> (three dots) in Chrome or your mobile browser.
                </span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span>
                  Select <strong>Add to Home screen</strong> or <strong>Install app</strong>.
                </span>
              </li>
            </ol>
          </div>
        )}

        <div className="install-footer-actions">
          <button
            type="button"
            className="share-btn"
            onClick={handleShareClick}
          >
            {canShare ? "📲 Share with Spouse / Family" : copied ? "✓ Link Copied!" : "📋 Copy Link"}
          </button>
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
