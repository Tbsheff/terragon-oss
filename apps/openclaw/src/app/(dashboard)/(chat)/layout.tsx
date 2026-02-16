import { ThreadListSidebar } from "@/components/thread-list/thread-list-sidebar";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] w-full">
      <ThreadListSidebar />
      <div className="flex flex-col h-[100dvh] min-w-0 flex-1">{children}</div>
    </div>
  );
}
