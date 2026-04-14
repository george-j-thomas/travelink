import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-background px-4 py-12">
      {/* Warm ambient glow — like distant shop lighting on a dark street */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-amber-900/[0.07] blur-[100px]"
      />

      <div className="relative w-full max-w-[400px]">
        {/* Brand mark */}
        <div className="mb-10 text-center">
          <span className="select-none text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Travel
            <span className="text-amber-500">ink</span>
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
