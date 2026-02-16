import { memo } from "react";
import { MessageResponse } from "@/components/ai-elements/message";

interface TextPartProps {
  text: string;
  githubRepoFullName?: string;
  branchName?: string;
  baseBranchName?: string;
  hasCheckpoint?: boolean;
}

function convertCitationsToGitHubLinks(
  text: string,
  githubRepoFullName?: string,
  branchName?: string,
  baseBranchName?: string,
  hasCheckpoint?: boolean,
): string {
  if (!githubRepoFullName) return text;

  const citationPattern =
    /\u3010F:([^\u2020]+)\u2020L(\d+)(?:-L?(\d+))?\u3011/g;

  return text.replace(
    citationPattern,
    (match, filename, startLine, endLine) => {
      const targetBranch =
        hasCheckpoint && branchName ? branchName : baseBranchName || "main";
      const baseUrl = `https://github.com/${githubRepoFullName}/blob/${targetBranch}/${filename}`;
      if (endLine) {
        return `[${filename}:L${startLine}-L${endLine}](${baseUrl}#L${startLine}-L${endLine})`;
      } else {
        return `[${filename}:L${startLine}](${baseUrl}#L${startLine})`;
      }
    },
  );
}

const TextPart = memo(function TextPart({
  text,
  githubRepoFullName,
  branchName,
  baseBranchName,
  hasCheckpoint,
}: TextPartProps) {
  const processedText = convertCitationsToGitHubLinks(
    text,
    githubRepoFullName,
    branchName,
    baseBranchName,
    hasCheckpoint,
  );
  return (
    <div className="prose prose-sm max-w-none text-pretty text-foreground">
      <MessageResponse>{processedText}</MessageResponse>
    </div>
  );
});

export { TextPart };
