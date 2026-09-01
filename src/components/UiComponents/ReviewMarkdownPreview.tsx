
import React from "react";

interface ReviewMarkdownPreviewProps {
  markdown: string;
}

export default function ReviewMarkdownPreview({ markdown }: ReviewMarkdownPreviewProps) {
  // A robust line-by-line markdown parser that returns clean React elements
  const parseMarkdown = (md: string): React.ReactNode[] => {
    const lines = md.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    const parseInline = (text: string): React.ReactNode[] => {
      // Very simple inline parser for bold (**), italic (*), inline code (`), and links
      // Return list of strings and React nodes
      let currentText = text;
      
      // Security: only allow safe link protocols in rendered output
      const isSafeUrl = (url: string): boolean => {
        const normalized = url.trim().toLowerCase();
        return (
          normalized.startsWith("http://") ||
          normalized.startsWith("https://") ||
          normalized.startsWith("/") ||
          normalized.startsWith("#") ||
          normalized.startsWith("mailto:")
        );
      };

      // Let's use a regex to tokenize inline elements
      // Tokens: **bold**, *italic*, `code`, [text](url), normal text
      const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
      const tokens = currentText.split(regex);
      
      return tokens.map((token, index) => {
        if (token.startsWith("**") && token.endsWith("**")) {
          return <strong key={index} className="font-semibold text-textPrimary">{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith("*") && token.endsWith("*")) {
          return <em key={index} className="italic text-textSecondary">{token.slice(1, -1)}</em>;
        }
        if (token.startsWith("`") && token.endsWith("`")) {
          return (
            <code key={index} className="bg-secondaryBg text-primary px-1.5 py-0.5 rounded font-mono text-[0.9em] border border-border">
              {token.slice(1, -1)}
            </code>
          );
        }
        if (token.startsWith("[") && token.includes("](")) {
          const closeBracket = token.indexOf("]");
          const linkText = token.slice(1, closeBracket);
          const linkUrl = token.slice(closeBracket + 2, -1);
          // Security: only render as <a> if the URL uses a safe protocol
          if (isSafeUrl(linkUrl)) {
            return (
              <a key={index} href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {linkText}
              </a>
            );
          }
          // Unsafe URL: render as plain text to prevent XSS
          return (
            <span key={index} className="text-textSecondary line-through" title="Link removed: unsafe URL protocol">
              {linkText}
            </span>
          );
        }
        return token;
      });
    };

    while (i < lines.length) {
      const line = lines[i];

      // 1. Code Block
      if (line.startsWith("```")) {
        const lang = line.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <div key={`code-${i}`} className="bg-gray-950/60 border border-border rounded-2xl p-4 my-4 overflow-x-auto font-mono text-sm">
            {lang && (
              <div className="flex justify-between items-center text-xs text-textMuted uppercase tracking-wider mb-2 font-sans select-none border-b border-border/50 pb-2">
                <span>{lang}</span>
              </div>
            )}
            <pre className="text-emerald-400">
              <code>{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        i++;
        continue;
      }

      // 2. Table
      if (line.startsWith("|")) {
        const tableRows: string[][] = [];
        let hasSeparator = false;
        
        while (i < lines.length && lines[i].startsWith("|")) {
          const row = lines[i]
            .split("|")
            .map(cell => cell.trim())
            .filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1);
          
          // Check if this is a separator row e.g. |---|---|
          const isSep = lines[i].replace(/[\s\-|:|]/g, "") === "";
          if (isSep) {
            hasSeparator = true;
          } else {
            tableRows.push(row);
          }
          i++;
        }
        
        const headers = tableRows[0] || [];
        const bodyRows = tableRows.slice(1);
        
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-6 border border-border rounded-xl">
            <table className="min-w-full divide-y divide-border border-collapse text-left text-sm text-textSecondary">
              <thead className="bg-secondaryBg text-textPrimary font-semibold uppercase tracking-wider text-xs">
                <tr>
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-4 py-3 border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-transparent">
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-border/10 transition-colors">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3 whitespace-pre-wrap">{parseInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // 3. Headers
      if (line.startsWith("#")) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, "");
        const content = parseInline(text);
        if (level === 1) {
          elements.push(<h1 key={`h1-${i}`} className="text-3xl font-bold mb-6 mt-8 text-textPrimary border-b border-border/50 pb-2">{content}</h1>);
        } else if (level === 2) {
          elements.push(<h2 key={`h2-${i}`} className="text-2xl font-semibold mb-4 mt-6 text-textPrimary">{content}</h2>);
        } else if (level === 3) {
          elements.push(<h3 key={`h3-${i}`} className="text-xl font-medium mb-3 mt-5 text-textPrimary">{content}</h3>);
        } else {
          elements.push(<h4 key={`h4-${i}`} className="text-lg font-medium mb-2 mt-4 text-textPrimary">{content}</h4>);
        }
        i++;
        continue;
      }

      // 4. Blockquotes
      if (line.startsWith(">")) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith(">")) {
          quoteLines.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        elements.push(
          <blockquote key={`quote-${i}`} className="text-textSecondary border-l-4 border-primary pl-4 mx-0 my-6 italic bg-secondaryBg/30 py-2 rounded-r-md">
            {quoteLines.map((ql, idx) => (
              <p key={idx} className="my-1">{parseInline(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // 5. Unordered List
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const listItems: string[] = [];
        while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
          listItems.push(lines[i].slice(2));
          i++;
        }
        elements.push(
          <ul key={`ul-${i}`} className="list-disc pl-6 my-4 space-y-2 text-textSecondary">
            {listItems.map((li, idx) => (
              <li key={idx}>{parseInline(li)}</li>
            ))}
          </ul>
        );
        continue;
      }

      // 6. Ordered List
      if (/^\d+\.\s/.test(line)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          listItems.push(lines[i].replace(/^\d+\.\s/, ""));
          i++;
        }
        elements.push(
          <ol key={`ol-${i}`} className="list-decimal pl-6 my-4 space-y-2 text-textSecondary">
            {listItems.map((li, idx) => (
              <li key={idx}>{parseInline(li)}</li>
            ))}
          </ol>
        );
        continue;
      }

      // 7. Horizontal Rule
      if (line.trim() === "---" || line.trim() === "***") {
        elements.push(<hr key={`hr-${i}`} className="border-border my-6" />);
        i++;
        continue;
      }

      // 8. Empty lines
      if (line.trim() === "") {
        i++;
        continue;
      }

      // 9. Plain Paragraph
      elements.push(
        <p key={`p-${i}`} className="my-4 leading-relaxed text-textSecondary">
          {parseInline(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return (
    <div className="prose prose-invert max-w-none text-textPrimary leading-7 text-[0.95rem]">
      {parseMarkdown(markdown)}
    </div>
  );
}
