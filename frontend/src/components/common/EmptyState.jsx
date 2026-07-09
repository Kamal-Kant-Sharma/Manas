import React from "react";

export default function EmptyState({ icon: Icon, title, description, action, testId }) {
  return (
    <div className="border border-dashed border-border p-10 rounded-sm text-center relative overflow-hidden" data-testid={testId}>
      {Icon && (
        <Icon
          className="absolute -right-6 -bottom-6 w-40 h-40 text-primary opacity-[0.06]"
          strokeWidth={1}
          aria-hidden="true"
        />
      )}
      <div className="relative">
        <div className="font-display text-xl">{title}</div>
        {description && <div className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{description}</div>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
