import type { ReactNode } from "react";

import { cn } from "@/core/utils/cn";

export function TableScroller({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
      {children}
    </table>
  );
}

export function TableHead({ columns }: { columns: readonly string[] }) {
  return (
    <thead>
      <tr className="border-border-subtle bg-surface-muted border-b">
        {columns.map((column) => (
          <th
            key={column}
            scope="col"
            className="px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.05em] text-slate-500 uppercase"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-surface-muted transition-colors">{children}</tr>;
}

export function TableCell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <td className={cn("px-4 py-3.5 align-middle text-slate-700", className)}>
      {children}
    </td>
  );
}

export function TableEmptyRow({
  columnCount,
  children,
}: {
  columnCount: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={columnCount} className="px-5 py-12">
        {children}
      </td>
    </tr>
  );
}
