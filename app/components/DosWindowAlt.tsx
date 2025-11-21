import React from "react";

interface DosWindowAltProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DosWindowAlt({ title, children, className = "" }: DosWindowAltProps) {
  return (
    <div className={`bg-[#00FFFF] border border-black flex flex-col ${className}`}>
      {/* Title Bar */}
      <div className="text-black py-0.5 px-2 flex items-center justify-center">
        {title}
      </div>

      {/* Inner White Box */}
      <div className="mx-1 mb-1 border border-black bg-white">
        {children}
      </div>
    </div>
  );
}
