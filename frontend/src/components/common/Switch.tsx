// components/common/SwitchButton.tsx
import React from "react";
import "./Switch.css";

type SwitchButtonProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function SwitchButton({ checked, onChange }: SwitchButtonProps) {
  return (
    <button onClick={() => onChange(!checked)} className={`switch ${checked ? "is-on" : ""}`}>
      <div className="switch-knob" />
    </button>
  );
}
