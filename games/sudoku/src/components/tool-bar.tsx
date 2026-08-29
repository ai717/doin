import { Eraser, Lightbulb, Pencil, Undo2 } from "lucide-react";
import type { ReactNode, PointerEvent } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

interface Props {
  noteMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  hintLeft: number;
  hintOpen?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onErase: () => void;
  onToggleNote: () => void;
  onHint: () => void;
  onFillNotes: () => void;
}

function Tool({
  label,
  hint,
  active,
  disabled,
  onClick,
  onLongPress,
  children,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onLongPress?: () => void;
  children: ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const didLong = useRef(false);

  const start = () => {
    if (!onLongPress || disabled) return;
    didLong.current = false;
    timer.current = window.setTimeout(() => {
      didLong.current = true;
      onLongPress();
      timer.current = null;
    }, 420);
  };
  const stop = (fireClick: boolean) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (fireClick && !didLong.current && !disabled) onClick();
  };

  return (
    <button
      type="button"
      aria-label={hint ?? label}
      title={hint ?? label}
      disabled={disabled}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={() => stop(true)}
      onPointerLeave={() => stop(false)}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] text-fg-muted transition-colors md:gap-1 md:text-xs",
        disabled && "opacity-40",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full border transition-colors md:size-12",
          active
            ? "border-accent bg-wash text-accent"
            : "border-border text-fg hover:bg-wash",
        )}
      >
        {children}
      </span>
      <span className={cn(active && "text-accent")}>{label}</span>
    </button>
  );
}

export function ToolBar({
  noteMode,
  canUndo,
  canRedo,
  disabled,
  hintLeft,
  hintOpen,
  onUndo,
  onRedo,
  onErase,
  onToggleNote,
  onHint,
  onFillNotes,
}: Props) {
  const t = useT();
  return (
    <div className="flex items-start justify-between" role="toolbar" aria-label={t("tool.bar")}>
      <Tool
        label={t("tool.undo")}
        hint={t("tool.undoHint")}
        disabled={disabled || (!canUndo && !canRedo)}
        onClick={onUndo}
        onLongPress={canRedo ? onRedo : undefined}
      >
        <Undo2 className="size-5 md:size-6" strokeWidth={1.75} />
      </Tool>
      <Tool label={t("tool.erase")} disabled={disabled} onClick={onErase}>
        <Eraser className="size-5 md:size-6" strokeWidth={1.75} />
      </Tool>
      <Tool
        label={t("tool.notes")}
        active={noteMode}
        disabled={disabled}
        onClick={onToggleNote}
        onLongPress={onFillNotes}
        hint={t("tool.notesHint")}
      >
        <Pencil className="size-5 md:size-6" strokeWidth={1.75} />
      </Tool>
      <Tool
        label={t("tool.hint")}
        disabled={disabled || (hintLeft <= 0 && !hintOpen)}
        onClick={onHint}
      >
        <Lightbulb className="size-5 md:size-6" strokeWidth={1.75} />
      </Tool>
    </div>
  );
}
