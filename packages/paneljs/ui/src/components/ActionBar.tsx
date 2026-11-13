import { Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListAction } from "../types";

export const ActionBar = ({
  actions,
  selectedCount,
  busy,
  onRun,
}: {
  actions: ListAction[];
  selectedCount: number;
  busy: boolean;
  onRun: (action: ListAction) => void;
}) => {
  const [actionName, setActionName] = useState(actions[0]?.name ?? "");
  const action =
    actions.find((candidate) => candidate.name === actionName) ?? actions[0];
  const isDeleteAction = action?.name === "delete_selected";

  if (actions.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b bg-muted px-3.5 py-2.5 text-muted-foreground"
      aria-label="Bulk actions"
    >
      <span className="min-w-[72px] font-mono text-[10px]">
        {selectedCount} selected
      </span>
      <Select
        items={actions.map((candidate) => ({
          label: candidate.label,
          value: candidate.name,
        }))}
        value={action?.name ?? null}
        onValueChange={(value) => {
          if (value) setActionName(value);
        }}
      >
        <SelectTrigger
          aria-label="Choose an action"
          className="min-w-[190px] bg-(--surface-input) text-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {actions.map((candidate) => (
            <SelectItem key={candidate.name} value={candidate.name}>
              {candidate.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={isDeleteAction ? "destructive" : "outline"}
        type="button"
        disabled={!action || selectedCount === 0 || busy}
        onClick={() => action && onRun(action)}
      >
        {isDeleteAction ? (
          <Trash2 aria-hidden />
        ) : (
          <Play fill="currentColor" aria-hidden />
        )}
        {busy ? "Running…" : isDeleteAction ? "Delete selected" : "Run action"}
      </Button>
    </div>
  );
};
