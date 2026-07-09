import React from "react";

export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="border-b border-border px-6 md:px-10 py-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        {eyebrow && <div className="overline mb-2">{eyebrow}</div>}
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
