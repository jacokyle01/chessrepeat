import React from 'react';
import type { Key } from 'chessground/types';
import './PromotionOverlay.css';

export type PromoRole = 'queen' | 'rook' | 'bishop' | 'knight';
const ROLES: PromoRole[] = ['queen', 'rook', 'bishop', 'knight'];

export function PromotionOverlay(props: {
  dest: Key;
  color: 'white' | 'black';
  onPick: (r: PromoRole) => void;
  onCancel: () => void;
  requiredRole?: PromoRole;
}) {
  const { color, onPick, onCancel, requiredRole } = props;

  return (
    <div className="promo-overlay" onClick={onCancel} onContextMenu={(e) => e.preventDefault()}>
      <div className="promo-scrim" />
      <div className="promo-center">
        <div className="promo-card merida" onClick={(e) => e.stopPropagation()}>
          <div className="promo-grid">
            {ROLES.map((role) => {
              const isRequired = requiredRole === role;
              const isDisabled = requiredRole != null && !isRequired;
              return (
                <button
                  key={role}
                  disabled={isDisabled}
                  className={`promo-option ${isRequired ? 'is-required' : ''}`}
                  onClick={() => onPick(role)}
                >
                  <piece className={`${role} ${color}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}