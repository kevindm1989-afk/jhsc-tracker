import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, ShieldCheck } from "lucide-react";

const DISMISSED_KEY = "pwa-install-dismissed";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const ios = isIOS();
    setIsIOSDevice(ios);

    if (ios) {
      // Small delay so the page finishes loading before showing the prompt
      const t = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setOpen(true);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
    setOpen(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const handleDismiss = () => {
    setOpen(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">Install JHSC Advisor</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Add the app to your home screen for quick access — works offline and feels like a native app.
          </DialogDescription>
        </DialogHeader>

        {isIOSDevice ? (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">How to install on iPhone / iPad</p>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
                <div className="text-sm">
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Share
                  </span>{" "}
                  button at the bottom of Safari
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
                <p className="text-sm">Scroll down and tap <span className="font-semibold">Add to Home Screen</span></p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
                <p className="text-sm">Tap <span className="font-semibold">Add</span> in the top-right corner</p>
              </li>
            </ol>
            <Button variant="ghost" className="w-full text-muted-foreground mt-1" onClick={handleDismiss}>
              Got it, maybe later
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <Button className="w-full font-semibold gap-2" onClick={handleInstall}>
              <Download className="w-4 h-4" />
              Install App
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleDismiss}>
              Not now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
