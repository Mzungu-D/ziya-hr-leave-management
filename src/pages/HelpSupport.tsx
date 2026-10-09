import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Headphones,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const faqItems: FAQItem[] = [
  {
    id: "leave-1",
    category: "Leave Management",
    question: "How do I apply for leave?",
    answer:
      "Open My Leave from the workspace navigation, select Apply Leave, choose the leave type and dates, provide the required details, then submit the request. Your request will follow the organization's configured approval process.",
  },
  {
    id: "leave-2",
    category: "Leave Management",
    question: "How can I check the status of my leave request?",
    answer:
      "Open My Leave to view your submitted requests and their current status. A request may be pending, manager approved, HR approved, rejected, or cancelled depending on its current stage.",
  },
  {
    id: "leave-3",
    category: "Leave Management",
    question: "What happens after my manager approves my leave?",
    answer:
      "Where HR approval is required, the request moves to the HR approval stage. The final status is shown in your leave history once the approval workflow is completed.",
  },
  {
    id: "account-1",
    category: "Account & Access",
    question: "What should I do if I cannot sign in?",
    answer:
      "Confirm that you are using the email address or phone number registered with your organization. If you still cannot access the system, contact your HR administrator or the organization's support contact.",
  },
  {
    id: "account-2",
    category: "Account & Access",
    question: "Why am I being asked for a verification code?",
    answer:
      "Verification may be required when the system needs to confirm your identity or verify a new device. Follow the verification instructions displayed on the login screen.",
  },
  {
    id: "account-3",
    category: "Account & Access",
    question: "How do I update my employee information?",
    answer:
      "Some employee information may be managed by HR. If a field cannot be changed from your employee workspace, contact your HR administrator and request an update.",
  },
  {
    id: "calendar-1",
    category: "Calendar & Holidays",
    question: "Are public holidays included in leave calculations?",
    answer:
      "Leave calculations use the organization's configured calendar and holiday settings. Your HR administrator is responsible for maintaining the organization's holiday calendar.",
  },
  {
    id: "manager-1",
    category: "Managers",
    question: "Where can managers review leave requests?",
    answer:
      "Managers can review requests assigned to them through the Leave Approvals workspace. Only requests within the manager's authorized organization and team scope should be displayed.",
  },
  {
    id: "privacy-1",
    category: "Privacy & Security",
    question: "Who can see my employee information?",
    answer:
      "Access is controlled by your organization's roles and permissions. Employees, managers and HR administrators receive access appropriate to their responsibilities.",
  },
];

const categories = [
  "All",
  "Leave Management",
  "Account & Access",
  "Calendar & Holidays",
  "Managers",
  "Privacy & Security",
];

function FAQCard({
  item,
  open,
  onToggle,
}: {
  item: FAQItem;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {item.category}
          </p>

          <p className="text-sm font-semibold text-slate-800">
            {item.question}
          </p>
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-sm leading-6 text-slate-600">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export function HelpSupport() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const filteredFAQs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return faqItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" ||
        item.category === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        item.question.toLowerCase().includes(normalizedSearch) ||
        item.answer.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [search, selectedCategory]);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
                <Headphones className="h-4 w-4" />
                Help & Support
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                How can we help?
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Find answers to common questions about leave, your account,
                approvals, calendars and using the Ziya HR system.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 rounded-2xl bg-[#071a35] p-5 shadow-sm sm:p-6">
          <div className="mx-auto max-w-3xl">
            <label
              htmlFor="help-search"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Search the help centre
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                id="help-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leave, account, approvals, holidays..."
                className="h-12 w-full rounded-xl border border-white/10 bg-white px-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#e3aa00] focus:ring-2 focus:ring-[#e3aa00]/30"
              />
            </div>
          </div>
        </div>

        {/* Quick Help */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CalendarDays className="h-5 w-5" />
            </div>

            <h2 className="font-semibold text-slate-900">
              Leave & Calendar
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Learn how leave requests, balances and holidays work.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>

            <h2 className="font-semibold text-slate-900">
              Employee & Manager
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Understand employee access, approvals and team workflows.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <h2 className="font-semibold text-slate-900">
              Account & Security
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Get help with sign-in, verification and account access.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <BookOpen className="h-5 w-5" />
            </div>

            <h2 className="font-semibold text-slate-900">
              Policies & Guidance
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Find guidance about organization policies and HR processes.
            </p>
          </div>
        </div>

        {/* Support contact */}
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#071a35] text-white">
                <MessageCircle className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Need more help?
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  If you cannot find an answer here, contact your organization's
                  HR administrator or designated system support team.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <Mail className="h-4 w-4 text-slate-400" />
                    Contact your HR administrator
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    Response time depends on your organization
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <FileText className="h-5 w-5" />
            </div>

            <h2 className="font-semibold text-slate-900">
              Before contacting support
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Include the page you were using, what you were trying to do and
              any error message shown on screen.
            </p>
          </div>
        </div>

        {/* FAQs */}
        <section>
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Frequently asked questions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Browse common questions or search for a specific answer.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = selectedCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-[#071a35] text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredFAQs.length > 0 ? (
            <div className="grid gap-3">
              {filteredFAQs.map((item) => (
                <FAQCard
                  key={item.id}
                  item={item}
                  open={openFaq === item.id}
                  onToggle={() =>
                    setOpenFaq((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <CircleHelp className="mx-auto h-10 w-10 text-slate-300" />

              <h3 className="mt-4 text-base font-semibold text-slate-800">
                No matching help articles
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Try a different search term or select another help category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                }}
                className="mt-5 rounded-lg bg-[#071a35] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b2549]"
              >
                Clear search
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}