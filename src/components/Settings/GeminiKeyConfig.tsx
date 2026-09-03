import { useState, useEffect } from "react";
import { toast } from "sonner";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";

export default function GeminiKeyConfig() {
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      localStorage.setItem("gemini_api_key", apiKey.trim());
      toast.success("Gemini API key saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save API key.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <VpnKeyIcon sx={{ fontSize: 20 }} className="text-textPrimary" />
            <h3 className="font-bold text-textPrimary">Gemini API Key</h3>
          </div>
          <p className="text-xs text-textMuted leading-relaxed max-w-md">
            Bring your own Google Gemini API key to power the documentation generation features.
            <br />
            Your key is stored locally on your machine and is never sent to our servers.
          </p>
        </div>
      </div>

      {/* Settings Form */}
      <div className="p-6 border border-border bg-secondaryBg/30 rounded-xl hover:border-primary/20 transition-all">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-textSecondary uppercase tracking-widest opacity-80">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-secondaryBg border border-border rounded-xl px-4 py-3 text-sm text-textPrimary placeholder-textMuted outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all duration-200 font-mono"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-primary hover:opacity-90 text-textPrimary px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SaveOutlinedIcon sx={{ fontSize: 16 }} />
              {isSaving ? "Saving..." : "Save Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
