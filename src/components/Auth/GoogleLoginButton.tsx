// src/app/components/Auth/GoogleLoginButton.tsx

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import GoogleIcon from "@mui/icons-material/Google";
import CircularLoader from "@/assets/svg/circular_loader";

export default function GoogleLoginButton() {
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
      provider: "google",
      options: {
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
      className="group relative w-full flex items-center justify-center gap-3 bg-secondaryBg text-textPrimary border border-border px-8 py-4 rounded-2xl font-bold transition-all duration-300 hover:bg-border active:scale-[0.98] shadow-xl shadow-black/10 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-red-500/10 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      {isLoading ? (
        <CircularLoader />
      ) : (
        <GoogleIcon sx={{ fontSize: { xs: 22, md: 24 } }} className="z-10" />
      )}
      <span className="text-sm md:text-base tracking-tight z-10">
        {isLoading ? "Authenticating…" : "Continue with Google"}
      </span>
    </button>
  );
}
