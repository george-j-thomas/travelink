import type { SVGProps } from "react";

/**
 * Instagram brand icon — simplified glyph matching the official mark.
 * Renders at currentColor so it inherits text color from parent.
 */
export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x={2} y={2} width={20} height={20} rx={5} />
      <circle cx={12} cy={12} r={5} />
      <circle cx={17.5} cy={6.5} r={1} fill="currentColor" stroke="none" />
    </svg>
  );
}
