import type { ReactNode } from "react";
import { AdminShellFrame } from "@/components/admin/admin-shell-frame";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShellFrame>{children}</AdminShellFrame>;
}
