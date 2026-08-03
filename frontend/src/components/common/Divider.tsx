import React from 'react';
import './Divider.css';

const Divider: React.FC<{ label: string }> = ({ label }) => (
  <div className="divider">
    <div className="divider-label">{label}</div>
  </div>
);

export default Divider;
