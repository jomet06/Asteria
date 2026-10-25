import { Fragment } from "react";

function inline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** A small, escaped text renderer. Model output never becomes raw HTML. */
export function MessageContent({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?(?:```|$))/g).filter(Boolean);
  return <div className="space-y-3 wrap-anywhere text-sm leading-7">{blocks.map((block, blockIndex) => {
    if (block.startsWith("```")) {
      return <pre key={blockIndex} className="overflow-x-auto whitespace-pre-wrap rounded-xl border bg-background/70 p-3 text-xs leading-6"><code>{block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</code></pre>;
    }
    return <Fragment key={blockIndex}>{block.trim().split(/\n\s*\n/).map((paragraph, index) => {
      const lines = paragraph.split("\n");
      if (lines.every((line) => /^\s*[-*] /.test(line))) return <ul key={index} className="list-disc space-y-1 pl-5">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*] /, ""))}</li>)}</ul>;
      if (lines.every((line) => /^\s*\d+[.)] /.test(line))) return <ol key={index} className="list-decimal space-y-1 pl-5">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*\d+[.)] /, ""))}</li>)}</ol>;
      return <p key={index} className="whitespace-pre-wrap">{inline(paragraph.replace(/^#{1,6}\s+/gm, ""))}</p>;
    })}</Fragment>;
  })}</div>;
}
