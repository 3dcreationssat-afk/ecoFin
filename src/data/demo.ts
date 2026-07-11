import {
  ArrowDownRight,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CreditCard,
  FileBarChart,
  Gauge,
  Goal,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Repeat2,
  Scale,
  Settings,
  ShieldCheck,
  WalletCards,
  Waves,
} from "lucide-react";
import type { ComponentType } from "react";

export type IconType = ComponentType<{ className?: string }>;

export const navSections: { title?: string; items: { label: string; href: string; icon: IconType }[] }[] = [
  { items: [{ label: "Overview", href: "/", icon: LayoutDashboard }] },
  {
    title: "Money Flow",
    items: [
      { label: "Transactions", href: "/transactions", icon: ArrowDownRight },
      { label: "Cash Flow", href: "/cash-flow", icon: Waves },
      { label: "Budget", href: "/budget", icon: WalletCards },
    ],
  },
  {
    title: "Planning",
    items: [
      { label: "Recurring", href: "/recurring", icon: Repeat2 },
      { label: "Debt", href: "/debt", icon: CreditCard },
      { label: "Goals", href: "/goals", icon: Goal },
      { label: "Decisions", href: "/decisions", icon: Scale },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: FileBarChart },
      { label: "Data Quality", href: "/data-quality", icon: ShieldCheck },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Accounts", href: "/accounts", icon: Landmark },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const pageMeta: Record<string, { title: string; subtitle: string; icon?: IconType }> = {
  "/": { title: "Overview", subtitle: "July 2026 · Updated today at 9:42 AM", icon: BarChart3 },
  "/transactions": { title: "Transactions", subtitle: "30 of 30 transactions · July 2026" },
  "/cash-flow": { title: "Cash Flow", subtitle: "July 2026 · Projected through month-end" },
  "/budget": { title: "Budget", subtitle: "July 2026 · Budgeted vs. actual vs. forecast" },
  "/recurring": { title: "Recurring Expenses", subtitle: "Subscriptions and recurring bills · 15 active" },
  "/debt": { title: "Debt Planner", subtitle: "4 debts · July 2026" },
  "/goals": { title: "Goals & Sinking Funds", subtitle: "4 active goals · July 2026" },
  "/decisions": { title: "Decision Simulator", subtitle: "Model financial decisions before you commit" },
  "/reports": { title: "Reports", subtitle: "Generate and export financial reports" },
  "/data-quality": { title: "Data Quality", subtitle: "Financial data health center · July 2026", icon: Gauge },
  "/accounts": { title: "Accounts", subtitle: "6 accounts · Updated Jul 10, 2026" },
  "/settings": { title: "Settings", subtitle: "Configure your household, preferences, and data" },
};

export const summaryCards = [
  { label: "Available Cash", value: "$22,620.55", detail: "2 accounts", icon: WalletCards },
  { label: "Projected Month-End", value: "$6,380.22", detail: "End of July", icon: CalendarDays },
  { label: "Safe to Save", value: "$1,450.00", detail: "After obligations", icon: BadgeDollarSign, featured: true },
  { label: "Safe to Spend", value: "$612.40", detail: "Discretionary remaining", icon: ListChecks },
  { label: "Total Debt", value: "$270,251.10", detail: "4 debts", icon: CreditCard },
];

export const transactions = [
  ["Jul 9", "Whole Foods Market", "WHOLE FOODS MARKET #123", "Everyday Checking", "Groceries", "-$87.42", "Reviewed"],
  ["Jul 9", "Starbucks", "STARBUCKS STORE #1234", "Everyday Checking", "Dining", "-$6.75", "Reviewed"],
  ["Jul 9", "Shell", "SHELL OIL 573821", "Everyday Checking", "Gas", "-$52.30", "Reviewed"],
  ["Jul 8", "Amazon", "AMAZON.COM*XX123", "Chase Sapphire", "Uncategorized", "-$34.99", "Uncategorized"],
  ["Jul 8", "Netflix", "NETFLIX.COM", "Everyday Checking", "Subscriptions", "-$15.99", "Reviewed"],
  ["Jul 8", "Target", "TARGET 00012345", "Everyday Checking", "Shopping", "-$42.99", "Possible duplicate"],
  ["Jul 8", "Target", "TARGET 00012345", "Everyday Checking", "Shopping", "-$42.99", "Possible duplicate"],
  ["Jul 7", "Payroll", "PAYROLL DEPOSIT", "Everyday Checking", "Income", "+$3,250.00", "Reviewed"],
  ["Jul 7", "Uber Eats", "UBER EATS", "Everyday Checking", "Dining", "-$28.50", "Reviewed"],
];

export const accounts = [
  ["Everyday Checking", "First National Bank", "Checking", "$8,420.55", "$8,420.55", "—", "—", "—", "Jul 9"],
  ["High-Yield Savings", "First National Bank", "Savings", "$14,200.00", "$14,200.00", "—", "—", "—", "Jul 9"],
  ["Chase Sapphire", "Chase", "Credit", "-$2,847.30", "$7,152.70", "$10,000", "21.49%", "Jul 17", "Jul 9"],
  ["Capital One Venture", "Capital One", "Credit", "-$1,203.80", "$8,796.20", "$10,000", "18.99%", "Jul 21", "Jul 8"],
  ["Auto Loan", "Toyota Financial", "Loan", "-$18,400.00", "—", "—", "4.90%", "—", "Jun 30"],
  ["Mortgage", "Quicken Loans", "Mortgage", "-$247,800.00", "—", "—", "3.75%", "—", "Jun 30"],
];

export const budgetRows = [
  ["Mortgage", "$1,650", "$1,650", "$1,650", "$0", "100%", "— $0.00", "Approaching limit"],
  ["Auto Loan", "$380", "$380", "$380", "$0", "100%", "— $0.00", "Approaching limit"],
  ["Car Insurance", "$180", "$180", "$180", "$0", "100%", "— $0.00", "Approaching limit"],
  ["Phone", "$85", "$85", "$85", "$0", "100%", "— $0.00", "Approaching limit"],
  ["Internet", "$70", "$70", "$70", "$0", "100%", "↗ +$5.00", "Approaching limit"],
  ["Life Insurance", "$45", "$45", "$45", "$0", "100%", "— $0.00", "Approaching limit"],
];

export const recurringRows = [
  ["Netflix", "Streaming", "$15.99", "Monthly", "$15.99", "$192", "In 4 days", "↗ +$2.00/mo", "Optional", "Review"],
  ["Spotify", "Music", "$11.99", "Monthly", "$11.99", "$144", "In 3 days", "—", "Useful", "Keep"],
  ["Amazon Prime", "Shopping", "$14.99", "Monthly", "$14.99", "$180", "9d ago", "—", "Useful", "Keep"],
  ["Adobe Creative Cloud", "Software", "$54.99", "Monthly", "$54.99", "$660", "Jul 19", "—", "Useful", "Review"],
  ["Planet Fitness", "Gym", "$39.99", "Monthly", "$39.99", "$480", "5d ago", "—", "Useful", "Keep"],
  ["AT&T", "Phone", "$85.00", "Monthly", "$85.00", "$1,020", "8d ago", "—", "Essential", "Keep"],
  ["Comcast", "Internet", "$70.00", "Monthly", "$70.00", "$840", "1d ago", "↗ +$5.00/mo", "Essential", "Renegotiate"],
];

export const debts = [
  ["1", "Chase Sapphire", "Credit Card", "21.49% APR · Est. payoff Aug 2027", "$2,847", "$285.00/mo"],
  ["2", "Capital One Venture", "Credit Card", "18.99% APR · Est. payoff Nov 2027", "$1,204", "$45.00/mo"],
  ["3", "Auto Loan", "Auto Loan", "4.90% APR · Est. payoff Jan 2031", "$18,400", "$380.00/mo"],
  ["4", "Mortgage", "Mortgage", "3.75% APR · Est. payoff Jun 2046", "$247,800", "$1,650.00/mo"],
];

export const goals = [
  ["Emergency Fund", "High-Yield Savings", "$8,400.00", "of $15,000", "56% complete", "$500.00", "$440.00", "On track"],
  ["Vehicle Down Payment", "High-Yield Savings", "$3,200.00", "of $10,000", "32% complete", "$400.00", "$560.00", "Approaching limit"],
  ["Vacation", "High-Yield Savings", "$1,100.00", "of $2,000", "55% complete", "$150.00", "$112.00", "On track"],
  ["Home Repairs", "High-Yield Savings", "$500.00", "of $2,500", "20% complete", "$100.00", "$100.00", "On track"],
];

export const reportBars = [
  ["Housing", 1650, "bg-[var(--teal)]"],
  ["Auto Loan", 380, "bg-[#348fb4]"],
  ["Groceries", 545, "bg-[#e3a72b]"],
  ["Insurance", 225, "bg-[#ae65cc]"],
  ["Dining", 52, "bg-[#d95787]"],
  ["Gas", 101, "bg-[var(--teal)]"],
  ["Utilities", 140, "bg-[#348fb4]"],
  ["Subscriptions", 44, "bg-[#e3a72b]"],
  ["Shopping", 146, "bg-[#ae65cc]"],
  ["Phone & Internet", 155, "bg-[#d95787]"],
] as const;

export const confidenceAreas = [
  ["Available cash", 100, "bg-[var(--green)]"],
  ["Spending by category", 72, "bg-[var(--amber)]"],
  ["Budget tracking", 72, "bg-[var(--amber)]"],
  ["Cash flow projection", 68, "bg-[var(--red)]"],
  ["Debt tracking", 85, "bg-[var(--amber)]"],
  ["Recurring expenses", 90, "bg-[var(--green)]"],
  ["Safe to save", 68, "bg-[var(--red)]"],
] as const;

export const cashTimeline = [
  { day: "Jul 1", balance: 6800 },
  { day: "Jul 2", balance: 5200 },
  { day: "Jul 3", balance: 4950 },
  { day: "Jul 5", balance: 4100 },
  { day: "Jul 6", balance: 3900 },
  { day: "Jul 8", balance: 7200 },
  { day: "Jul 10", balance: 8421 },
  { day: "Jul 15", balance: 8300 },
  { day: "Jul 22", balance: 8100 },
  { day: "Jul 28", balance: 7700 },
  { day: "Jul 31", balance: 6380 },
];

export const cashBars = [
  ["Income received", "+$4,850.00", "w-full bg-[var(--teal)]"],
  ["Spending", "-$2,980.44", "w-[62%] bg-[var(--amber)]"],
  ["Upcoming obligations", "-$1,240.00", "w-[26%] bg-[#c65380]"],
  ["Planned savings", "-$1,450.00", "w-[30%] bg-[#348fb4]"],
];

export const overviewComparison = [
  ["Income", "$4,850.00", "— $0.00"],
  ["Spending", "$2,980.44", "↗ +$340.12"],
  ["Savings", "$1,450.00", "↗ +$200.00"],
  ["Debt paid", "$420.00", "↗ +$45.00"],
];
