import React from "react";

interface BoxingGloveIconProps {
  className?: string;
  size?: number;
}

const BoxingGloveIcon: React.FC<BoxingGloveIconProps> = ({ className, size = 24 }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Boxing glove shape */}
      <path d="M5 10c0-3 2-5 5-5h2c2 0 4 1 5 3l1 2c1 2 1 4 0 6l-1 2c-1 2-3 3-5 3H9c-2 0-4-2-4-4v-7z" />
      {/* Thumb */}
      <path d="M5 12c-1 0-2-1-2-2s1-2 2-2" />
      {/* Wrist strap */}
      <path d="M9 19v2" />
      <path d="M13 19v2" />
      <path d="M7 21h8" />
    </svg>
  );
};

export default BoxingGloveIcon;
