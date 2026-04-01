import React from 'react';
import type { Key } from 'chessground/types';

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
    <div
      className="fixed inset-0 z-[9999999]"
      onClick={onCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`merida bg-white/90 rounded-xl shadow-xl p-3`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-2">
            {ROLES.map((role) => {
              const isRequired = requiredRole === role;
              const isDisabled = requiredRole != null && !isRequired;
              return (
                <button
                  key={role}
                  disabled={isDisabled}
                  className={`relative rounded-lg transition ${
                    isRequired
                      ? 'bg-blue-200 ring-2 ring-blue-400'
                      : isDisabled
                        ? 'bg-black/5 opacity-30 cursor-not-allowed'
                        : 'bg-black/5 hover:bg-black/10'
                  }`}
                  style={{
                    width: 56,
                    height: 56,
                  }}
                  onClick={() => onPick(role)}
                >
                  <piece className={`${role} ${color} absolute inset-0`} style={{ backgroundSize: 'contain' }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}