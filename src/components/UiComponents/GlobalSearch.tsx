import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  InputBase,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import TextSnippetIcon from "@mui/icons-material/TextSnippetOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { useUser } from "@/core/auth/UserContext";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResult {
  id: string | number;
  name: string;
  type: "file" | "folder";
  organization_id: number | null;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { organization } = useUser();
  const router = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleResultClick(results[selectedIndex]);
      }
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0) {
      const element = document.getElementById(`search-result-${selectedIndex}`);
      if (element) {
        element.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    } else {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [open]);

  useEffect(() => {
    async function performSearch() {
      if (debouncedQuery.trim().length === 0) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}&orgId=${organization?.id || ""}`,
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (open) {
      performSearch();
    }
  }, [debouncedQuery, organization?.id, open]);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "file") {
      navigate(`/dashboard?doc=${result.id}`);
      onClose();
    }
    // Could also handle folder navigation if needed
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      onKeyDown={handleKeyDown}
      slotProps={{
        paper: {
          sx: {
            backgroundColor: "#161B22",
            color: "#F8FAFC",
            borderRadius: "12px",
            border: "1px solid #1E293B",
          },
        },
      }}
    >
      <div className="flex items-center px-4 py-3 border-b border-border">
        <SearchIcon className="text-textSecondary mr-3" />
        <InputBase
          inputRef={inputRef}
          placeholder="Search documents by name or content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full text-textSecondary"
          style={{ color: "inherit" }}
        />
        {loading ? (
          <CircularProgress size={20} className="text-textSecondary ml-3" />
        ) : (
          <span
            className="text-textMuted text-xs px-1 py-0.5 rounded-md border border-border ml-3 cursor-pointer"
            onClick={onClose}
          >
            Esc
          </span>
        )}
      </div>
      <DialogContent style={{ minHeight: "300px", padding: 0 }}>
        {results.length === 0 && query.length > 0 && !loading && (
          <div className="flex items-center justify-center h-full text-textSecondary py-10">
            No results found
          </div>
        )}
        {results.length > 0 && (
          <div className="flex flex-col">
            {results.map((item, index) => (
              <div
                key={item.id}
                id={`search-result-${index}`}
                onClick={() => handleResultClick(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`py-3 px-4 flex items-start text-textSecondary cursor-pointer transition-colors border-b border-border/50 ${
                  selectedIndex === index
                    ? "bg-border/50"
                    : "hover:bg-border/50"
                }`}
              >
                {item.type === "folder" ? (
                  <FolderOpenIcon
                    className="text-textSecondary mr-3 mt-0.5"
                    fontSize="small"
                  />
                ) : (
                  <TextSnippetIcon
                    className="text-textSecondary mr-3 mt-0.5"
                    fontSize="small"
                  />
                )}
                <div className="text-sm font-medium">{item.name}</div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
