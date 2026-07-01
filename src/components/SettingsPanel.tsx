import { ServerCog, UserRound, X } from "lucide-react";
import type { KamiyaAuthContext } from "../../shared/types";

interface SettingsPanelProps {
  auth: KamiyaAuthContext;
  open: boolean;
  onClose: () => void;
  onChange: (auth: KamiyaAuthContext) => void;
}

export function SettingsPanel({ auth, open, onClose, onChange }: SettingsPanelProps) {
  if (!open) return null;

  return (
    <aside className="settings-panel" aria-label="Kamiya settings">
      <div className="settings-head">
        <div>
          <h2>Settings</h2>
          <p>Connect Kamiya to Cerbanimo as an API client.</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">
          <X size={18} />
        </button>
      </div>

      <div className="settings-note">
        <ServerCog size={16} />
        <p>
          Cerbanimo API access is configured on the backend with <code>KAMIYA_CERBANIMO_API_URL</code> and{" "}
          <code>KAMIYA_CERBANIMO_BEARER_TOKEN</code>. Secrets are never entered in the browser.
        </p>
      </div>

      <label>
        <span>
          <UserRound size={16} /> Display name
        </span>
        <input
          value={auth.displayName ?? ""}
          onChange={(event) => onChange({ ...auth, displayName: event.target.value })}
          placeholder="Glaed"
        />
      </label>

      <button
        className="primary wide"
        type="button"
        onClick={() => onChange({ ...auth, isLoggedIn: !auth.isLoggedIn })}
      >
        {auth.isLoggedIn ? "Use logged-out mode" : "Use logged-in mode"}
      </button>
    </aside>
  );
}
