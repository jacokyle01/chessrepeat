import React from 'react';

const Divider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center my-4">
    <div className="flex-grow border-t border-gray-300" />
    <div className="mx-4 text-sm font-semibold text-gray-500">{label}</div>
    <div className="flex-grow border-t border-gray-300" />
  </div>
);

export default Divider;
