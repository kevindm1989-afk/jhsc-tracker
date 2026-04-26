import { useLocation } from "wouter";
import { Scale, Users, BookOpen, MessageSquare, ClipboardList, ArrowLeft, ChevronRight } from "lucide-react";

interface Section {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  heading: string;
  law: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    icon: Scale,
    color: "text-red-600",
    heading: "Right to Refuse Unsafe Work",
    law: "OHSA s.43",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Every worker in Ontario has the right to refuse work they believe is likely to endanger
          themselves or another worker. You cannot be disciplined, threatened, or punished for
          exercising this right in good faith.
        </p>
        <div className="space-y-3">
          <p className="font-semibold text-foreground">Steps to follow:</p>
          <ol className="space-y-3 list-none">
            {[
              {
                step: "1",
                title: "Stop work and report",
                body: "Tell your supervisor or employer that you are refusing the work and explain why you believe it is unsafe. Stay nearby at a safe location.",
              },
              {
                step: "2",
                title: "Investigation — Stage 1",
                body: "Your supervisor must investigate the refusal immediately, with you present and, if available, a JHSC worker rep or health and safety representative.",
              },
              {
                step: "3",
                title: "If unresolved — Stage 2",
                body: "If you are still not satisfied, the refusal continues. A Ministry of Labour inspector must be called. You are entitled to remain at a safe location until the inspector arrives and renders a decision.",
              },
              {
                step: "4",
                title: "No reprisal",
                body: "Your employer cannot reassign you to unsafe alternative work, dock your pay, or threaten you for refusing. If reprisal occurs, you can file a complaint under OHSA s.50.",
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center text-xs font-bold">
                  {item.step}
                </span>
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Remember:</strong> A good-faith belief that work is unsafe is all that is required.
          You do not need proof.
        </div>
      </div>
    ),
  },
  {
    icon: Users,
    color: "text-blue-600",
    heading: "Right to Participate",
    law: "OHSA s.9",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Workers have the right to participate in workplace health and safety through the Joint
          Health and Safety Committee (JHSC). This is not optional for your employer — it is
          required by law.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: "What is the JHSC?",
              body: "A committee made up of worker and management representatives that identifies and addresses health and safety issues at the workplace. Workplaces with 20 or more workers are required to have one.",
            },
            {
              title: "Who sits on it?",
              body: "At least half the members must be workers who do not exercise managerial functions. The JHSC must have co-chairs — one chosen by workers, one by management.",
            },
            {
              title: "What does the Worker Co-Chair do?",
              body: "Leads health and safety on behalf of workers. Conducts inspections, investigates incidents, reviews reports, makes recommendations, and communicates findings to the workforce.",
            },
            {
              title: "Your right to participate",
              body: "Any worker can raise a concern with the JHSC. JHSC members are entitled to time off with pay for meetings, inspections, and training.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border bg-muted/40 p-4">
              <p className="font-semibold text-foreground text-sm">{item.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: BookOpen,
    color: "text-green-600",
    heading: "Right to Know",
    law: "OHSA s.25(2)(j)",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Your employer is legally required to inform you of any hazard in the workplace. This
          includes providing access to WHMIS information, Safety Data Sheets (SDS), and training
          on any hazardous materials you may encounter.
        </p>
        <div className="space-y-3">
          {[
            {
              title: "WHMIS / GHS",
              body: "Workplace Hazardous Materials Information System. Every hazardous product must be labelled and accompanied by a Safety Data Sheet (SDS) that you can request and review at any time.",
            },
            {
              title: "Safety Data Sheets (SDS)",
              body: "Detailed documents describing a product's hazards, safe handling procedures, first aid measures, and emergency response. Your employer must make these accessible during every shift.",
            },
            {
              title: "Training",
              body: "You must be trained on the hazards of materials you work with before you begin that work. Training must be in a language and format you understand.",
            },
            {
              title: "How to access this information",
              body: "Ask your supervisor or the JHSC. If you cannot get access, raise the issue with the Worker Co-Chair through this app or in person.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <ChevronRight className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: MessageSquare,
    color: "text-purple-600",
    heading: "How to Contact the JHSC",
    law: "Your access point",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          You do not need to wait for a formal meeting to raise a concern. The JHSC is here
          year-round and you can reach us in several ways.
        </p>
        <div className="space-y-3">
          {[
            {
              icon: "📱",
              title: "Submit through this app",
              body: 'Log in and use "Conduct A H&S Concern" to submit a concern report, or "Submit a Suggestion" for general safety suggestions. Reports are received immediately by the Worker Co-Chair.',
            },
            {
              icon: "🗣️",
              title: "Speak directly to the Worker Co-Chair",
              body: "You can approach any JHSC worker member in person. All concerns are treated seriously and followed up in writing.",
            },
            {
              icon: "📋",
              title: "During an inspection",
              body: "Monthly workplace inspections are an opportunity to point out hazards you have noticed. You can accompany the inspector or report observations after.",
            },
            {
              icon: "🔒",
              title: "Confidentiality",
              body: "Your name will not be shared with management without your consent. You can request that a concern be investigated anonymously.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border bg-muted/40 p-4 flex gap-3">
              <span className="text-2xl leading-none mt-0.5">{item.icon}</span>
              <div>
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: ClipboardList,
    color: "text-orange-600",
    heading: "What Happens After You Report",
    law: "From report to resolution",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Every concern submitted is tracked from start to finish. Here is what happens after you
          report a health or safety issue.
        </p>
        <ol className="space-y-4 list-none">
          {[
            {
              step: "1",
              color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
              title: "Concern received",
              body: "The Worker Co-Chair receives the report and reviews it. You may be contacted for more information if needed.",
            },
            {
              step: "2",
              color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
              title: "Investigation",
              body: "The JHSC investigates the hazard — this may include a physical inspection, review of existing records, or interviews with workers in the area.",
            },
            {
              step: "3",
              color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
              title: "Recommendation",
              body: "The JHSC writes a formal recommendation to management describing the hazard and the corrective action required. This is documented in writing.",
            },
            {
              step: "4",
              color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
              title: "Management response",
              body: "Management is required by law to respond in writing within 21 days, stating whether they accept the recommendation and what action they will take.",
            },
            {
              step: "5",
              color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
              title: "Follow-up & closure",
              body: "The JHSC tracks the recommendation until the hazard is resolved. If management does not respond or disagrees, the issue can be escalated to the Ministry of Labour.",
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-3">
              <span className={`flex-shrink-0 w-7 h-7 rounded-full ${item.color} flex items-center justify-center text-xs font-bold`}>
                {item.step}
              </span>
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          <strong>Transparency:</strong> Recommendations and their status are tracked in this app.
          Speak to the Worker Co-Chair if you want an update on any outstanding concern.
        </div>
      </div>
    ),
  },
];

export default function KnowYourRightsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-40 bg-[#1a2744] text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Scale className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm sm:text-base leading-tight">JHSC Worker Rights Hub</p>
            <p className="text-xs text-blue-200 leading-tight hidden sm:block">
              Ontario OHSA — Plain-language guide to your rights
            </p>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1.5 text-xs sm:text-sm bg-white/10 hover:bg-white/20 transition-colors rounded-md px-3 py-1.5 font-medium flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Login
          </button>
        </div>
      </div>

      {/* Intro */}
      <div className="bg-[#1a2744] text-white">
        <div className="max-w-3xl mx-auto px-4 pb-8 pt-4">
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed max-w-2xl">
            As a worker in Ontario, the Occupational Health and Safety Act gives you three fundamental
            rights. This page explains those rights in plain language. This information is provided by
            your Joint Health &amp; Safety Committee.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {["Right to Refuse", "Right to Participate", "Right to Know"].map((r) => (
              <span key={r} className="bg-white/15 text-white text-xs font-medium px-3 py-1 rounded-full">
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.heading} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-background border flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-5 h-5 ${section.color}`} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-foreground text-base leading-tight">
                    {section.heading}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">{section.law}</p>
                </div>
              </div>
              <div className="px-6 py-5">{section.content}</div>
            </div>
          );
        })}

        {/* Footer CTA */}
        <div className="rounded-xl border-2 border-[#1a2744] bg-[#1a2744]/5 dark:bg-[#1a2744]/20 p-6 text-center space-y-4">
          <p className="font-bold text-foreground text-lg">Ready to report a concern?</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Sign in to the JHSC Advisor app to submit a health and safety concern, make a suggestion,
            or contact the Worker Co-Chair directly.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 bg-[#1a2744] hover:bg-[#243360] text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Information based on the Occupational Health and Safety Act (Ontario). For legal advice,
          consult a qualified professional.&nbsp;&nbsp;|&nbsp;&nbsp;OHSA S.9 · S.25 · S.43
        </p>
      </div>
    </div>
  );
}
