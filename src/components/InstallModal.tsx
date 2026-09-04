import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PlatformType =
  | "ios-safari"
  | "ios-chrome"
  | "android"
  | "mac-safari"
  | "desktop-chrome"
  | "generic";

export function detectPlatform(isMobileDevice: boolean): PlatformType {
  if (typeof navigator === "undefined") return "generic";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isIOSChrome = isIOS && /CriOS/i.test(ua);
  const isChromium =
    /Chrome|Chromium|Edg/i.test(ua) ||
    Boolean((window as unknown as { chrome?: unknown }).chrome);
  const isSafari = /Safari/i.test(ua) && !isChromium;
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;

  if (isIOS) return isIOSChrome ? "ios-chrome" : "ios-safari";
  if (isAndroid) return "android";
  if (isMobileDevice) return "ios-safari"; // Phone fallback (default to iOS in SMFC)
  if (isMac && isSafari) return "mac-safari";
  if (isChromium) return "desktop-chrome";
  return "generic";
}

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isMobile: boolean;
}

export function InstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  isMobile,
}: InstallModalProps) {
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<PlatformType>(() =>
    detectPlatform(isMobile)
  );

  useEffect(() => {
    if (!isOpen) return;
    setPlatform(detectPlatform(isMobile));
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMobile, onClose]);

  if (!isOpen) return null;

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

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
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="install-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">
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
            <button className="install-primary-btn" onClick={handleInstallClick}>
              ⚡️ Install App Now
            </button>
            <p className="install-note">Adds Lunchbox directly to your device</p>
          </div>
        ) : (
          <div className="quick-guide-box">
            <div className="platform-selector-bar">
              <label htmlFor="platform-select">Device:</label>
              <select
                id="platform-select"
                className="platform-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as PlatformType)}
              >
                <option value="ios-safari">iPhone / iPad (Safari)</option>
                <option value="ios-chrome">iPhone / iPad (Chrome)</option>
                <option value="android">Android (Chrome)</option>
                <option value="mac-safari">Mac (Safari)</option>
                <option value="desktop-chrome">Desktop (Chrome / Edge)</option>
              </select>
            </div>

            <div className="install-steps-list">
              {platform === "ios-safari" && (
                <>
                  <div className="install-step-item">
                    <span className="step-badge">1</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap the <strong>Share</strong> button
                        <span className="step-icon-badge" aria-hidden="true">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                        </span>
                      </div>
                      <span className="step-desc">In Safari's bottom toolbar</span>
                    </div>
                  </div>

                  <div className="install-step-item">
                    <span className="step-badge">2</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap <strong>Add to Home Screen</strong>
                        <span className="step-icon-badge" aria-hidden="true">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="4" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                        </span>
                      </div>
                      <span className="step-desc">Scroll down the share sheet</span>
                    </div>
                  </div>

                  <div className="install-step-item">
                    <span className="step-badge">3</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap <strong>Add</strong>
                        <span className="step-icon-badge check" aria-hidden="true">
                          ✓
                        </span>
                      </div>
                      <span className="step-desc">In the top-right corner</span>
                    </div>
                  </div>
                </>
              )}

              {platform === "ios-chrome" && (
                <>
                  <div className="install-step-item">
                    <span className="step-badge">1</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap <strong>Share</strong> in address bar
                      </div>
                      <span className="step-desc">Or tap ⋯ in bottom corner &gt; Share</span>
                    </div>
                  </div>

                  <div className="install-step-item">
                    <span className="step-badge">2</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap <strong>Add to Home Screen</strong>
                      </div>
                      <span className="step-desc">(If missing, open this page in Safari)</span>
                    </div>
                  </div>

                  <div className="install-step-item">
                    <span className="step-badge">3</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap <strong>Add</strong>
                        <span className="step-icon-badge check" aria-hidden="true">
                          ✓
                        </span>
                      </div>
                      <span className="step-desc">In the top-right corner</span>
                    </div>
                  </div>
                </>
              )}

              {platform === "android" && (
                <>
                  <div className="install-step-item">
                    <span className="step-badge">1</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap the <strong>Menu (⋮)</strong>
                      </div>
                      <span className="step-desc">In the top-right corner of Chrome</span>
                    </div>
                  </div>

                  <div className="install-step-item">
                    <span className="step-badge">2</span>
                    <div className="step-content">
                      <div className="step-title">
                        Tap <strong>Install app</strong> or <strong>Add to Home</strong>
                      </div>
                      <span className="step-desc">Lunchbox icon will appear on your phone</span>
                    </div>
                  </div>
                </>
              )}

              {platform === "mac-safari" && (
                <>
                  <div className="install-step-item">
                    <span className="step-badge">1</span>
                    <div className="step-content">
                      <div className="step-title">
                        Click <strong>File</strong> in Mac menu bar
                      </div>
                      <span className="step-desc">At the very top of your screen</span>
                    </div>
                  </div>

                  <div className="install-step-item">
                    <span className="step-badge">2</span>
                    <div className="step-content">
                      <div className="step-title">
                        Click <strong>Add to Dock...</strong>
                      </div>
                      <span className="step-desc">Runs Lunchbox as an independent Mac app</span>
                    </div>
                  </div>
                </>
              )}

              {(platform === "desktop-chrome" || platform === "generic") && (
                <div className="install-step-item">
                  <span className="step-badge">1</span>
                  <div className="step-content">
                    <div className="step-title">
                      Click the <strong>Install icon (⊕)</strong>
                    </div>
                    <span className="step-desc">On the right side of the browser address bar</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="install-footer-actions">
          {canShare && (
            <button type="button" className="share-btn" onClick={handleShareClick}>
              📲 Share
            </button>
          )}
          {!canShare && (
            <button type="button" className="share-btn" onClick={handleShareClick}>
              {copied ? "✓ Copied!" : "📋 Copy Link"}
            </button>
          )}
          <button type="button" className="dismiss-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
