"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAgents } from "@/server-actions/agents";
import {
  memorySearchQueryOptions,
  memoryFileQueryOptions,
} from "@/queries/memory-queries";
import { cn } from "@/lib/utils";
import {
  Brain,
  Search,
  AlertCircle,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MemoryPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { data: agentsResult } = useQuery({
    queryKey: ["agents"],
    queryFn: listAgents,
  });

  const agents = agentsResult?.ok ? agentsResult.data : [];

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResult, isLoading: searchLoading } = useQuery(
    memorySearchQueryOptions(selectedAgent, debouncedQuery),
  );

  const results = searchResult?.ok ? searchResult.data : [];
  const searchError = searchResult?.ok === false ? searchResult.error : null;

  const { data: fileResult } = useQuery({
    ...memoryFileQueryOptions(selectedAgent, selectedFile ?? ""),
    enabled: !!selectedFile && !!selectedAgent,
  });

  const fileContent = fileResult?.ok ? fileResult.data : null;

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-balance font-[var(--font-cabin)]">
              Memory
            </h1>
            <p className="text-xs text-pretty text-muted-foreground mt-0.5">
              Search and browse agent memory files
            </p>
          </div>
        </div>
      </div>
      <Separator />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Agent Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Select Agent
          </label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.emoji || "🤖"} {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Bar */}
        {selectedAgent && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Search Memory
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter search query..."
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* States */}
        {!selectedAgent && (
          <Card className="animate-fade-in border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Brain className="size-6 text-primary/60" />
              </div>
              <p className="mt-3 text-sm font-medium text-balance text-foreground">
                Select an agent
              </p>
              <p className="mt-1 text-xs text-pretty text-muted-foreground max-w-[280px] text-center">
                Choose an agent above to search their memory files
              </p>
            </CardContent>
          </Card>
        )}

        {selectedAgent && !debouncedQuery && (
          <Card className="animate-fade-in border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Search className="size-6 text-primary/60" />
              </div>
              <p className="mt-3 text-sm font-medium text-balance text-foreground">
                Enter a search query
              </p>
              <p className="mt-1 text-xs text-pretty text-muted-foreground max-w-[280px] text-center">
                Search for specific content in this agent&apos;s memory
              </p>
            </CardContent>
          </Card>
        )}

        {searchLoading && debouncedQuery && (
          <div className="space-y-3">
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="py-0 animate-pulse">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <div className="size-3.5 rounded bg-muted" />
                          <div className="h-3 w-40 rounded bg-muted" />
                        </div>
                        <div className="h-4 w-full rounded bg-muted" />
                        <div className="flex gap-1.5">
                          <div className="h-5 w-20 rounded-full bg-muted" />
                          <div className="h-5 w-16 rounded-full bg-muted" />
                        </div>
                      </div>
                      <div className="size-4 rounded bg-muted mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {searchError && (
          <Card className="animate-fade-in border-destructive/50 bg-destructive/5">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-6 text-destructive" />
              </div>
              <p className="mt-3 text-sm font-medium text-balance text-foreground">
                Gateway disconnected
              </p>
              <p className="mt-1 text-xs text-pretty text-muted-foreground max-w-[280px] text-center">
                {searchError}
              </p>
            </CardContent>
          </Card>
        )}

        {!searchLoading &&
          !searchError &&
          debouncedQuery &&
          results.length === 0 && (
            <Card className="animate-fade-in border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="size-6 text-primary/60" />
                </div>
                <p className="mt-3 text-sm font-medium text-balance text-foreground">
                  No results found
                </p>
                <p className="mt-1 text-xs text-pretty text-muted-foreground max-w-[280px] text-center">
                  Try a different search query
                </p>
              </CardContent>
            </Card>
          )}

        {/* Search Results */}
        {!searchLoading && !searchError && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            <div className="grid gap-2">
              {results.map((result) => (
                <Card
                  key={`${result.filePath}:${result.lineStart}-${result.lineEnd}`}
                  className={cn(
                    "py-0 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                    selectedFile === result.filePath && "border-primary",
                  )}
                  onClick={() => setSelectedFile(result.filePath)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText className="size-3.5 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs font-mono text-muted-foreground truncate">
                            {result.filePath}
                          </p>
                        </div>
                        <p className="text-sm text-pretty text-foreground line-clamp-2">
                          {result.text}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] tabular-nums bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          >
                            Lines {result.lineStart}-{result.lineEnd}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] tabular-nums bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                          >
                            Score: {result.score.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* File Viewer */}
        {selectedFile && fileContent && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs font-medium font-mono text-foreground truncate">
                {fileContent.path}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] tabular-nums ml-auto flex-shrink-0"
              >
                {fileContent.lines} lines
              </Badge>
            </div>
            <Card>
              <CardContent className="p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  {fileContent.content}
                </pre>
              </CardContent>
            </Card>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFile(null)}
              className="w-full"
            >
              Close File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
