import React from "react";

export type OpenClawThread = {
  id: string;
  name: string | null;
  status: string;
  pipelineState: string | null;
  tokenUsage: string | null;
  githubRepoFullName: string | null;
  createdAt: string;
};

type ThreadContextType = {
  thread: OpenClawThread | null;
  isReadOnly: boolean;
};

export const ThreadContext = React.createContext<ThreadContextType>({
  thread: null,
  isReadOnly: false,
});

export const useThread = () => React.use(ThreadContext);

export function ThreadProvider({
  children,
  thread,
  isReadOnly,
}: { children: React.ReactNode } & ThreadContextType) {
  const value = React.useMemo(
    () => ({ thread, isReadOnly }),
    [thread, isReadOnly],
  );
  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}
