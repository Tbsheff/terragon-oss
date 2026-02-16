import { NavRail } from "@/components/nav-rail";
import { NotificationProvider } from "@/components/notification-provider";
import { GatewayProvider } from "@/components/gateway-provider";
import { DashboardTitleSync } from "./dashboard-title-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full">
      <NotificationProvider />
      <DashboardTitleSync />
      <NavRail />
      <GatewayProvider>
        <div className="flex flex-col min-w-0 flex-1">{children}</div>
      </GatewayProvider>
    </div>
  );
}
