import React from "react";

interface DosWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DosWindow({ title, children, className = "" }: DosWindowProps) {
  return (
    <div className={`bg-[#C0C0C0] border border-black flex flex-col ${className}`}>
      {/* Raised 3D effect */}
      <div className="w-full h-full border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex flex-col">
        {/* Title Bar */}
        <div className="bg-[#0000AA] text-white py-0.5 px-2 flex items-center">
          {title}
        </div>

        {/* Inner Sunken Box */}
        <div className="flex-1 mx-1.5 my-1.5 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0] overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
