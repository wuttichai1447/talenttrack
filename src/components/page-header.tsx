import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("border-b bg-card", className)}>
      <div className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {badge ? (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {badge}
            </p>
          ) : null}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
