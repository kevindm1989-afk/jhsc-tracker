import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TruncatedTextProps {
  text: string;
  lines?: number;
  label?: string;
  className?: string;
}

export function TruncatedText({ text, lines = 2, label, className = "" }: TruncatedTextProps) {
  const [open, setOpen] = useState(false);

  const clampClass = `line-clamp-${lines}`;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className={`cursor-pointer ${clampClass} ${className}`}
        title="Click to read full text"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
      >
        {text}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          {label && (
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">{label}</DialogTitle>
            </DialogHeader>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
