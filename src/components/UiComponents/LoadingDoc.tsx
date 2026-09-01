
import { useState, useEffect } from "react";

interface LoadingDocProps {
  isGenerating?: boolean;
}

const LoadingDoc = ({ isGenerating = false }: LoadingDocProps) => {
  const [activeLine, setActiveLine] = useState(0);

  // Cycle through active lines to "mimic" typing/processing
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLine((prev) => (prev + 1) % 6);
    }, 1500);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full h-full max-w-4xl mx-auto px-8 py-10 space-y-8 overflow-hidden relative">
      {/* Scanning Beam Effect (Only for generating) */}
      {isGenerating && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent z-10 animate-scan pointer-events-none" />
      )}

      <div className="space-y-4">
        <div className="h-10 bg-border/40 rounded-lg w-3/4 relative overflow-hidden group">
          <div className="absolute inset-0" />
        </div>
        <div className="h-4 bg-border/30 rounded-md w-1/4 relative overflow-hidden">
          <div className="absolute inset-0" />
        </div>
      </div>

      {/* Content Skeleton with "Typing/Processing" vibe */}
      <div className="space-y-8 pt-8">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`space-y-4 transition-all duration-700 ${activeLine === i ? "opacity-100 translate-x-1" : "opacity-40"}`}
          >
            <div className="flex items-start gap-4">
              {/* Line number/status indicator */}
              {isGenerating && (
                <div
                  className={`w-1 h-6 rounded-full transition-colors duration-500 ${activeLine === i ? "bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" : "bg-border/20"}`}
                />
              )}

              <div className="flex-1 space-y-3">
                <div
                  className="h-3 bg-border/40 rounded relative overflow-hidden"
                  style={{ width: `${Math.floor(Math.random() * 30) + 60}%` }}
                >
                  {activeLine === i && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer" />
                  )}
                </div>
                {i % 2 === 0 && (
                  <div className="h-3 bg-border/30 rounded relative overflow-hidden w-full">
                    {activeLine === i && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer-fast" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% {
            transform: translateY(-100px);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(800px);
            opacity: 0;
          }
        }
        @keyframes shimmer-fast {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
        .animate-shimmer-fast {
          animation: shimmer-fast 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingDoc;
