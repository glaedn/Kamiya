import { suggestSlashCommands } from "../../shared/commands";

interface CommandMenuProps {
  input: string;
  onPick: (command: string) => void;
}

export function CommandMenu({ input, onPick }: CommandMenuProps) {
  const suggestions = suggestSlashCommands(input);
  if (!suggestions.length) return null;

  return (
    <div className="command-menu" role="listbox" aria-label="Slash command suggestions">
      {suggestions.map((command) => (
        <button key={command.name} type="button" onClick={() => onPick(`${command.name} `)}>
          <span>{command.name}</span>
          <small>{command.description}</small>
        </button>
      ))}
    </div>
  );
}
