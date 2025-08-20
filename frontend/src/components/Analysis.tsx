// components/Analysis.tsx
import { useStockfish } from "../hooks/useStockfish";
import SwitchButton from "./common/Switch";

export const Analysis = () => {
  const { enabled, startEngine, stopEngine, lines } = useStockfish();

  const handleToggle = (checked: boolean) => {
    if (checked) {
      startEngine();
    } else {
      stopEngine();
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Toggle engine */}
      <SwitchButton checked={enabled} onChange={handleToggle} />

      {/* Results */}
      <div>
        {lines.map((l, i) => (
          <div key={i}>
            <strong>Line {i + 1}:</strong> {l.line} ({l.score})
          </div>
        ))}
      </div>
    </div>
  );
};
