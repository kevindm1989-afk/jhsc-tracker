export interface NavConfig {
  name: string;
  href: string;
  permission: string | null;
  adminOnly?: boolean;
  workerRepOnly?: boolean;
}

export const NAV_CONFIGS: NavConfig[] = [
  { name: "Dashboard", href: "/", permission: "dashboard" },
  { name: "Action Items", href: "/action-items", permission: "action-items" },
  { name: "Closed Items Log", href: "/closed-items-log", permission: "closed-items-log" },
  { name: "Member Actions", href: "/member-actions", permission: "member-actions" },
  { name: "Conduct A H&S Report", href: "/health-safety-report", permission: "health-safety-report" },
  { name: "H&S Reports Log", href: "/hs-reports-log", permission: "hs-reports-log" },
  { name: "Recommendations", href: "/hazard-findings", permission: "hazard-findings" },
  { name: "Inspection Log", href: "/inspection-log", permission: "inspection-log" },
  { name: "Conduct Inspection", href: "/conduct-inspection", permission: "conduct-inspection" },
  { name: "Worker Statements", href: "/worker-statements", permission: "worker-statements" },
  { name: "Submit a Suggestion", href: "/suggestions", permission: "suggestions" },
  { name: "Suggestions Log", href: "/suggestions-log", permission: "suggestions" },
  { name: "Right to Refuse", href: "/right-to-refuse", permission: "right-to-refuse", workerRepOnly: true },
  { name: "Files", href: "/files", permission: "files" },
  { name: "Import Data", href: "/import-minutes", permission: "import-data" },
  { name: "Manage Users", href: "/manage-users", permission: null, adminOnly: true },
  { name: "Meeting Transcription", href: "/meeting-transcription", permission: null },
];

const seen = new Set<string>();
export const PERMISSION_LABELS: Record<string, string> = {};
for (const item of NAV_CONFIGS) {
  if (item.permission && !item.adminOnly && !item.workerRepOnly && !seen.has(item.permission)) {
    seen.add(item.permission);
    PERMISSION_LABELS[item.permission] = item.name;
  }
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);
