import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, Info, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Checklist data (mirrors server checklistData.ts) ────────────────────────

interface ChecklistItem {
  key: string;
  description: string;
  hint: string;
  row: number;
}

interface ChecklistSection {
  name: string;
  items: ChecklistItem[];
}

const ZONES = [
  "Zone 1 — Process / Production",
  "Zone 2 — Tank Gallery / Labs",
  "Zone 3 — Basement / Raw Milk Receiving",
  "Zone 4 — Employee Facilities",
  "Zone 5 — Exterior Building",
  "Zone 6 — Cold Warehouse",
  "Zone 7 — WH #2 / Case Wash",
  "Zone 8 — Maintenance / Boiler / Ammonia",
  "Zone 9 — Caser Stacker / Chain System",
  "Zone 10 — Warehouse #1",
  "Zone 11 — Maintenance Boiler / Hot Water",
];

const SECTIONS: ChecklistSection[] = [
  {
    name: "Emergency Exits",
    items: [
      { key: "1.1", description: "Exits are not blocked", hint: "Must have a 3 foot path to the door", row: 11 },
      { key: "1.2", description: "Clear and free of debris", hint: "Nothing on the floor that may cause a slip trip or fall", row: 12 },
      { key: "1.3", description: "Exit signs are in place", hint: "Exit light must be working", row: 13 },
      { key: "1.4", description: "Emergency lighting available and not blocked", hint: "Can't have anything blocking the path of the light", row: 14 },
    ],
  },
  {
    name: "Floors / Aisles",
    items: [
      { key: "2.1", description: "Floors are clean and free of debris", hint: "Damaged products, shrink wrap, cardboard", row: 27 },
      { key: "2.2", description: "No obstructions in walk ways", hint: "There's a clear travel path with no obstructions", row: 28 },
      { key: "2.3", description: "No large cracks in floors", hint: "No uneven floor", row: 29 },
      { key: "2.4", description: "All drain covers / grills are in place (not sunken)", hint: "As Stated", row: 30 },
      { key: "2.5", description: "All spills (wet or dry) are clearly identified and cleaned up", hint: "If spill is present it must be marked with a pylon or some kind of warning sign", row: 31 },
    ],
  },
  {
    name: "Stairs (inside and outside)",
    items: [
      { key: "3.1", description: "Are there proper hand / guardrails", hint: "As Stated", row: 33 },
      { key: "3.2", description: "Is there proper lighting", hint: "No dark spots, all lights working", row: 34 },
      { key: "3.3", description: "Is there appropriate tread / cleats", hint: "Must be one on every step", row: 35 },
      { key: "3.4", description: "Are stairs clear and free of debris", hint: "As Stated", row: 36 },
      { key: "3.5", description: "Are stairs clean and dry", hint: "Outdoor stairs free of ice", row: 37 },
    ],
  },
  {
    name: "GHS / WHMIS",
    items: [
      { key: "4.1", description: "Is there a SDS station installed in the facility, complete with SDS binder that is not blocked or obstructed?", hint: "Locate facility SSDS binder and is it accessible to all employees?", row: 46 },
      { key: "4.2", description: "Are the SDS Sheets up to date?", hint: "", row: 47 },
      { key: "4.3", description: "All chemicals are properly labeled with a supplier or workplace label for all decanted products", hint: "As Stated", row: 48 },
    ],
  },
  {
    name: "Personal Protective Equipment",
    items: [
      { key: "5.1", description: "Steel toes footwear meets CSA requirements", hint: "Fasten properly, no holes, adequate tread", row: 51 },
      { key: "5.2", description: "Safety harnesses and lanyards are available and in proper working condition and properly stored", hint: "Check harness and lanyard for condition and last inspection date", row: 52 },
      { key: "5.3", description: "PPE available as appropriate (i.e. face shield, apron, gloves)", hint: "Survey employees and ask what they do prior to using harness and lanyard", row: 53 },
    ],
  },
  {
    name: "Emergency Response Equipment",
    items: [
      { key: "6.1", description: "First aid kit(s) available", hint: "Meets regulations requirements", row: 56 },
      { key: "6.2", description: "First aid kit(s) stocked as per Regulations", hint: "Verify each kit has been checked monthly and is in accordance to legislative inventory", row: 57 },
      { key: "6.3", description: "First aid signs visible", hint: "Are there visible signs for First Aid Kits", row: 58 },
      { key: "6.4", description: "Spill Kits available in the designated areas and inspected?", hint: "Verify spill kit in the dept are available and have the correct inventory", row: 59 },
      { key: "6.5", description: "Fire Extinguishers operational and present as required", hint: "As Stated", row: 60 },
      { key: "6.6", description: "All Fire Extinguishers are properly stored and not obstructed or blocked", hint: "Fire extinguishers are to be mounted and secured from accidental movement", row: 61 },
      { key: "6.7", description: "Fire Extinguisher Signage is present", hint: "As Stated", row: 62 },
      { key: "6.8", description: "Fire Extinguishers checked monthly", hint: "Check monthly inspection report", row: 63 },
      { key: "6.9", description: "Eyewash station functioning, clean and accessible", hint: "Check they are not blocked and that they work", row: 64 },
      { key: "6.10", description: "Diphoterine kit accessible", hint: "Check expiry date and if anything has been used", row: 65 },
      { key: "6.11", description: "Inspect Emergency Kits (Control room; Dispatch; maintenance shop)", hint: "Check expiry date and if anything has been used", row: 66 },
    ],
  },
  {
    name: "Machine Handling",
    items: [
      { key: "7.1", description: "Stopping and sound horn when required", hint: "As Stated", row: 69 },
      { key: "7.2", description: "No forks elevated or extended while driving", hint: "2 to 3 inches without a load, 4 to 6 inches when traveling with a load", row: 70 },
      { key: "7.3", description: "Using caution when entering or exiting blind corners or trailers", hint: "As Stated", row: 71 },
      { key: "7.4", description: "All body parts are within the confines of the machine", hint: "Are they wearing a seat belt if applicable", row: 72 },
      { key: "7.5", description: "Machine is completely stopped before stepping off", hint: "As Stated", row: 73 },
      { key: "7.6", description: "Forks are lowered when machine is not in use", hint: "", row: 74 },
      { key: "7.7", description: "Are pre-operational inspections being completed by operators prior to use of machinery?", hint: "Select 2 drivers and review inspection check sheet for completion and signoff", row: 75 },
      { key: "7.8", description: "Verify annual inspection date on MHE in the area", hint: "Annual inspection required for all MHE", row: 76 },
    ],
  },
  {
    name: "Other Equipment",
    items: [
      { key: "8.1", description: "No wooden or painted ladders — and are in good working order", hint: "All rungs in place, proper footing", row: 79 },
      { key: "8.2", description: "Pre ops being completed on equipment", hint: "Check 3 random pieces of equipment for completion. Must have name and date", row: 80 },
      { key: "8.3", description: "Are there lock out / tag out tools available for all equipment and SOP being followed?", hint: "Verify there are locks and lock out tags available at the facility and lockout meets legislative requirements", row: 81 },
      { key: "8.4", description: "Hand tools in good repair", hint: "Electrical cords not frayed, casing have no holes", row: 82 },
      { key: "8.5", description: "Are guards on equipment in good condition?", hint: "Check guards to ensure they are intact; request for pre-op inspections to verify guarding is inspected on a daily basis", row: 83 },
    ],
  },
  {
    name: "Electrical Panels",
    items: [
      { key: "9.1", description: "Not obstructed", hint: "Electrical room is not a storage room", row: 91 },
      { key: "9.2", description: "Covers / doors / caps on electrical panels", hint: "Nothing stored on top of or in panels", row: 92 },
    ],
  },
  {
    name: "Employee Interview",
    items: [
      { key: "10.1", description: "Is there a situation, task or process that doesn't make sense? (DUMB)", hint: "", row: 104 },
      { key: "10.2", description: "Is there a risky task, process, situation or hazard? (DANGEROUS)", hint: "", row: 105 },
      { key: "10.3", description: "Is there an unusual or difficult task or process? (DIFFICULT)", hint: "", row: 106 },
      { key: "10.4", description: "Is there a changing or changed situation, activity or task? (DIFFERENT)", hint: "", row: 107 },
    ],
  },
];

const TOTAL_ITEMS = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);

// ─── Types ────────────────────────────────────────────────────────────────────

type Rating = "A" | "B" | "C" | "X";

interface ItemResponse {
  rating: Rating | null;
  correctiveAction: string;
}

// ─── Rating button config ─────────────────────────────────────────────────────

const RATINGS: { value: Rating; label: string; short: string; cls: string; activeCls: string }[] = [
  { value: "A", label: "A — Major", short: "A", cls: "border-red-200 text-red-700 hover:bg-red-50", activeCls: "bg-red-600 text-white border-red-600" },
  { value: "B", label: "B — Moderate", short: "B", cls: "border-amber-200 text-amber-700 hover:bg-amber-50", activeCls: "bg-amber-500 text-white border-amber-500" },
  { value: "C", label: "C — Minor", short: "C", cls: "border-yellow-200 text-yellow-700 hover:bg-yellow-50", activeCls: "bg-yellow-500 text-white border-yellow-500" },
  { value: "X", label: "X — No Issue", short: "X", cls: "border-green-200 text-green-700 hover:bg-green-50", activeCls: "bg-green-600 text-white border-green-600" },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConductInspectionPage() {
  const today = new Date().toISOString().split("T")[0];

  const [zoneIndex, setZoneIndex] = useState<number>(0);
  const [date, setDate] = useState(today);
  const [inspector, setInspector] = useState("");
  const [responses, setResponses] = useState<Record<number, ItemResponse>>({});
  const [additionalComments, setAdditionalComments] = useState("");
  const handleZoneChange = (newIndex: number) => {
    const hasData = Object.values(responses).some(r => r.rating !== null) || additionalComments.trim();
    if (hasData) {
      if (!window.confirm(`Switch to ${ZONES[newIndex]}?\n\nThis will clear all responses for the current zone. Email the Co-Chair first to save your work.`)) return;
    }
    setZoneIndex(newIndex);
    setResponses({});
    setAdditionalComments("");
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Progress
  const ratedCount = useMemo(() => Object.values(responses).filter(r => r.rating !== null).length, [responses]);
  const findingCount = useMemo(() => Object.values(responses).filter(r => r.rating && r.rating !== "X").length, [responses]);
  const progressPct = Math.round((ratedCount / TOTAL_ITEMS) * 100);

  const setRating = (row: number, rating: Rating | null) => {
    setResponses(prev => ({
      ...prev,
      [row]: { ...prev[row], rating, correctiveAction: prev[row]?.correctiveAction ?? "" },
    }));
  };

  const setField = (row: number, value: string) => {
    setResponses(prev => ({
      ...prev,
      [row]: { ...prev[row], rating: prev[row]?.rating ?? null, correctiveAction: value },
    }));
  };

  const buildPayload = () => ({
    zoneIndex,
    date,
    inspector,
    responses: Object.fromEntries(
      Object.entries(responses).map(([k, v]) => [k, { rating: v.rating, correctiveAction: v.correctiveAction }])
    ),
    additionalComments,
  });

  const [isEmailing, setIsEmailing] = useState(false);

  const handleEmail = async () => {
    if (ratedCount === 0) {
      toast({ title: "Nothing to submit", description: "Rate at least one checklist item before submitting.", variant: "destructive" });
      return;
    }
    setIsEmailing(true);
    try {
      const resp = await fetch(`${BASE}/api/inspect/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Submit failed: ${resp.status}`);
      }
      const data = await resp.json();
      queryClient.invalidateQueries();
      const parts: string[] = [`Email sent to Kevin (Co-Chair)`];
      if (data.imported > 0) parts.push(`${data.imported} finding${data.imported !== 1 ? "s" : ""} logged`);
      if (data.docSaved) parts.push("form saved to Documents");
      toast({ title: "Inspection submitted", description: parts.join(" · ") });
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setIsEmailing(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Clear all responses and start over?")) return;
    setResponses({});
    setAdditionalComments("");
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Conduct Inspection</h1>
          <p className="text-muted-foreground mt-1 text-sm">Complete the checklist, then click Email Co-Chair to send the report, log all findings, and save the form to Documents.</p>
        </div>
      </div>

      {/* Setup panel */}
      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Inspection Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="zone">Zone</Label>
            <Select value={String(zoneIndex)} onValueChange={v => handleZoneChange(Number(v))}>
              <SelectTrigger id="zone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((z, i) => (
                  <SelectItem key={i} value={String(i)}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Inspection Date</Label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inspector">Inspector Name</Label>
            <Input id="inspector" placeholder="Your name" value={inspector} onChange={e => setInspector(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{ratedCount} of {TOTAL_ITEMS} items rated</span>
          <div className="flex items-center gap-3">
            {findingCount > 0 && (
              <span className="text-xs font-bold text-destructive">{findingCount} finding{findingCount !== 1 ? "s" : ""}</span>
            )}
            <span className="text-xs text-muted-foreground">{progressPct}% complete</span>
          </div>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Rating legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground font-medium mr-1">Rating:</span>
        {RATINGS.map(r => (
          <span key={r.value} className={cn("px-2 py-0.5 rounded border font-bold", r.activeCls)}>{r.label}</span>
        ))}
      </div>

      {/* Checklist */}
      <div className="space-y-4">
        {SECTIONS.map(section => (
          <Card key={section.name} className="border-sidebar-border shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-foreground">{section.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              {/* Column headers — only visible on large screens */}
              <div className="hidden lg:flex px-4 py-1.5 bg-muted/40 border-b gap-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="w-[38%]">Inspection Item</div>
                <div className="flex-1">Corrective Action</div>
                <div className="w-[168px] text-right">Rating</div>
              </div>
              {section.items.map(item => {
                const resp = responses[item.row];
                const rating = resp?.rating ?? null;
                const hasIssue = rating && rating !== "X";

                return (
                  <div key={item.row} className={cn("px-4 py-3 transition-colors", hasIssue ? "bg-red-50/40" : "hover:bg-muted/20")}>
                    {/* 3-column layout: description | corrective action | rating buttons */}
                    <div className="flex flex-col lg:flex-row lg:items-start gap-3">

                      {/* Col 1 — Item description */}
                      <div className="lg:w-[38%] min-w-0">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5 w-8">{item.key}</span>
                          <div>
                            <p className="text-sm font-medium text-foreground leading-snug">{item.description}</p>
                            {item.hint && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 hover:text-foreground transition-colors">
                                    <Info className="w-3 h-3" />
                                    <span className="truncate max-w-[240px]">{item.hint}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs">{item.hint}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Col 2 — Corrective action (always visible) */}
                      <div className="lg:flex-1 min-w-0">
                        <Textarea
                          rows={2}
                          placeholder="Corrective action..."
                          value={resp?.correctiveAction ?? ""}
                          onChange={e => setField(item.row, e.target.value)}
                          className="text-sm resize-none w-full"
                        />
                      </div>

                      {/* Col 3 — Rating buttons */}
                      <div className="flex gap-1.5 shrink-0 lg:mt-0.5">
                        {RATINGS.map(r => (
                          <button
                            key={r.value}
                            onClick={() => setRating(item.row, rating === r.value ? null : r.value)}
                            className={cn(
                              "w-9 h-9 sm:w-10 sm:h-10 rounded-md text-xs font-bold border transition-all",
                              rating === r.value ? r.activeCls : cn("bg-background", r.cls)
                            )}
                            title={r.label}
                          >
                            {r.short}
                          </button>
                        ))}
                      </div>

                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Comments */}
      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="py-3 px-4 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">Additional Comments</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Textarea
            rows={4}
            placeholder="Any additional observations or comments about this zone inspection..."
            value={additionalComments}
            onChange={e => setAdditionalComments(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
        <div className="max-w-screen-lg mx-auto px-4 py-3 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 text-sm text-muted-foreground hidden sm:block">
            <span className="font-medium">{ZONES[zoneIndex]}</span>
            {date && <span className="ml-2 text-xs">· {date}</span>}
            {inspector && <span className="ml-2 text-xs">· {inspector}</span>}
            {ratedCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                · {ratedCount} rated{findingCount > 0 ? `, ${findingCount} finding${findingCount !== 1 ? "s" : ""}` : ""}
              </span>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleReset} className="text-xs px-3 shrink-0">
              Reset
            </Button>
            <Button
              onClick={handleEmail}
              disabled={isEmailing || ratedCount === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex-1 sm:flex-none sm:min-w-[200px]"
            >
              <Mail className="w-4 h-4 mr-1.5 shrink-0" />
              <span className="truncate">{isEmailing ? "Submitting..." : "Email Co-Chair"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
