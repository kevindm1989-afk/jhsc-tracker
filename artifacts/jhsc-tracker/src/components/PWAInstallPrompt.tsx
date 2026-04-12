import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, ShieldCheck } from "lucide-react";

const DISMISSED_KEY = "pwa-install-dismissed";

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Don't show if user already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

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
    if (outcome === "accepted") {
      setPrompt(null);
    }
    setOpen(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const handleDismiss = () => {
    setOpen(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!prompt) return null;

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
        <div className="flex flex-col gap-2 pt-2">
          <Button className="w-full font-semibold gap-2" onClick={handleInstall}>
            <Download className="w-4 h-4" />
            Install App
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleDismiss}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
