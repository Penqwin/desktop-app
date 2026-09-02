// src/app/components/Auth/LoginButton.tsx

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import GitHubIcon from "@mui/icons-material/GitHub";
import CircularLoader from "@/assets/svg/circular_loader";

export default function LoginButton() {
  const supabase = createClient();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);

    const next = searchParams.get("next") || "/dashboard";
    const params = new URLSearchParams(searchParams.toString());
    params.delete("next");
    const queryString = params.toString();
    const nextUrl = queryString ? `${next}?${queryString}` : next;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        // This tells Supabase where to send the user AFTER GitHub auth
        redirectTo: `${window.location.origin}/core/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });

    if (error) {
      console.error("OAuth error:", error.message);
      setIsLoading(false);
    }
    // On success the page redirects, so no need to reset loading
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="group relative w-full flex items-center justify-center gap-3 bg-textPrimary text-mainBg px-8 py-4 rounded-2xl font-bold transition-all duration-300 hover:bg-white active:scale-[0.98] shadow-xl shadow-white/5 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-100 group-hover:opacity-0 transition-opacity duration-300" />
      {isLoading ? (
        <CircularLoader />
      ) : (
        <GitHubIcon sx={{ fontSize: { xs: 22, md: 24 } }} className="z-10" />
      )}
      <span className="text-sm md:text-base tracking-tight z-10">
        {isLoading ? "Authenticating…" : "Continue with GitHub"}
      </span>
    </button>
  );
}
