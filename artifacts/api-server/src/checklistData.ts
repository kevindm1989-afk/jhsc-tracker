export interface ChecklistItem {
  key: string;
  description: string;
  hint: string;
  row: number; // 1-indexed Excel row in the template
}

export interface ChecklistSection {
  name: string;
  items: ChecklistItem[];
}

// Zones match exactly to the Excel sheets "Inspection 1" through "Inspection 11"
export const ZONE_NAMES = [
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

// Row 110 is where "Additional Comments:" label appears in the template
export const ADDITIONAL_COMMENTS_ROW = 110;

// Extracted from JHSC Monthly Workplace Inspection Form — same checklist for all zones
export const CHECKLIST_SECTIONS: ChecklistSection[] = [
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
    name: "Machine Handling (driving observations)",
    items: [
      { key: "7.1", description: "Stopping and sound horn when required", hint: "As Stated", row: 69 },
      { key: "7.2", description: "No forks elevated or extended while driving", hint: "2 to 3 inches without a load 4 to 6 inches when traveling with a load", row: 70 },
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
      { key: "8.5", description: "Are guards on equipment in good condition?", hint: "Check guards to ensure they are intact; request for pre-op inspections on equipment to verify guarding is inspected on a daily basis", row: 83 },
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

export const TOTAL_ITEMS = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
