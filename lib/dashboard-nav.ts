import {
  CalendarDays,
  ClipboardList,
  MessageSquare,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type DashboardSection =
  | "registration"
  | "financials"
  | "programs"
  | "communications"
  | "rosters";

export type DashboardNavItem = {
  id: DashboardSection;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  {
    id: "registration",
    label: "Registration",
    description: "Program overview, greetings, and registration insights.",
    icon: ClipboardList,
  },
  {
    id: "financials",
    label: "Financials",
    description: "Payment links, balances, and registration fees.",
    icon: Wallet,
  },
  {
    id: "programs",
    label: "Programs",
    description: "Programs, clinics, availability, and program rosters.",
    icon: CalendarDays,
  },
  {
    id: "communications",
    label: "Communications",
    description: "Messages, reminders, and family updates.",
    icon: MessageSquare,
  },
  {
    id: "rosters",
    label: "Rosters",
    description: "Registered players and roster management.",
    icon: Users,
  },
];
