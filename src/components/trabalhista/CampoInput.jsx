import React from 'react';

export default function CampoInput({ label, required = false, hint = '', className = '', ...props }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[#3c4043] mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...props}
        required={required}
        className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
      />
      {hint && <p className="text-[11px] text-[#9aa0a6] mt-0.5">{hint}</p>}
    </div>
  );
}