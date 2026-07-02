import { LogIn, LogOut, ServerCog, UserRound, X } from "lucide-react";
import type { KamiyaAuthContext } from "../../shared/types";

interface SettingsPanelProps {
  auth: KamiyaAuthContext;
  open: boolean;
  isLoggingIn: boolean;
  loginError?: string;
  onClose: () => void;
  onChange: (auth: KamiyaAuthContext) => void;
  onLogin: () => void;
  onLogout: () => void;
}

export function SettingsPanel({ auth, open, isLoggingIn, loginError, onClose, onChange, onLogin, onLogout }: SettingsPanelProps) {
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
          Log in through Cerbanimo Auth0. Kamiya opens Cerbanimo's auth bridge in a popup, receives the access token, and keeps it in
          browser session storage only.
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
        onClick={auth.isLoggedIn ? onLogout : onLogin}
        disabled={isLoggingIn}
      >
        {auth.isLoggedIn ? <LogOut size={16} /> : <LogIn size={16} />}
        {isLoggingIn ? "Opening Cerbanimo..." : auth.isLoggedIn ? "Log out" : "Log in with Cerbanimo"}
      </button>

      {loginError ? <p className="settings-error">{loginError}</p> : null}
    </aside>
  );
}
