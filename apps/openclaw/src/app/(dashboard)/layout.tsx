import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { NotificationProvider } from "@/components/notification-provider";
import { GatewayProvider } from "@/components/gateway-provider";
import { DashboardTitleSync } from "./dashboard-title-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <NotificationProvider />
      <DashboardTitleSync />
      <AppSidebar />
      <SidebarInset>
        <GatewayProvider>{children}</GatewayProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
