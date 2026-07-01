import { KeyRound, Link2, UserRound, X } from "lucide-react";
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

      <label>
        <span>
          <Link2 size={16} /> Cerbanimo API URL
        </span>
        <input
          value={auth.cerbanimoApiUrl ?? ""}
          onChange={(event) => onChange({ ...auth, cerbanimoApiUrl: event.target.value })}
          placeholder="http://localhost:4000"
        />
      </label>

      <label>
        <span>
          <KeyRound size={16} /> Bearer token
        </span>
        <input
          type="password"
          value={auth.cerbanimoToken ?? ""}
          onChange={(event) => onChange({ ...auth, cerbanimoToken: event.target.value, isLoggedIn: Boolean(event.target.value) })}
          placeholder="Paste a local development JWT"
        />
      </label>

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
