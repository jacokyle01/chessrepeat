// components/common/SwitchButton.tsx
import React from "react";

type SwitchButtonProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function SwitchButton({ checked, onChange }: SwitchButtonProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
        checked ? "bg-green-500" : "bg-gray-400"
      }`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}
