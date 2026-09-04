import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/core/auth/UserContext";
import BusinessIcon from "@mui/icons-material/Business";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { toast } from "sonner";

export default function CreateOrgPage() {
  const navigate = useNavigate();
  const { createOrganization } = useUser();
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createOrganization(orgName.trim());
      // The context handles navigation to '/' upon creation by reloading
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create workspace");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-secondaryBg overflow-hidden flex items-center justify-center font-sans text-textPrimary">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-info/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

      <button 
        onClick={() => navigate(-1)}
        className="absolute top-8 left-8 flex items-center gap-2 text-textMuted hover:text-textPrimary transition-colors group z-10"
      >
        <ArrowBackIcon className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium tracking-wide text-sm uppercase">Back</span>
      </button>

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md p-10 bg-secondaryBg/40 backdrop-blur-2xl border border-border/50 shadow-2xl rounded-3xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-info flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
            <BusinessIcon sx={{ fontSize: 32 }} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-textPrimary mb-2">
            Create Workspace
          </h1>
          <p className="text-center text-textSecondary text-sm leading-relaxed">
            A workspace is your dedicated environment for documentation. Organize your repos, docs, and settings seamlessly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 relative">
            <label htmlFor="orgName" className="text-xs font-semibold text-textMuted uppercase tracking-wider pl-1">
              Workspace Name
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-info rounded-xl blur opacity-0 group-focus-within:opacity-30 transition duration-500"></div>
              <input
                ref={inputRef}
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="relative w-full bg-secondaryBg/80 border border-border focus:border-transparent text-textPrimary text-base rounded-xl px-4 py-3 outline-none transition-all placeholder:text-textMuted shadow-inner"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!orgName.trim() || isSubmitting}
            className="group relative w-full flex items-center justify-center gap-2 bg-textPrimary text-secondaryBg font-semibold text-base rounded-xl px-4 py-3.5 outline-none hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden mt-2 shadow-lg"
          >
            <span className="relative z-10">
              {isSubmitting ? "Creating..." : "Create Workspace"}
            </span>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-primary/10 to-info/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-in-out"></div>
          </button>
        </form>
      </div>
    </div>
  );
}
