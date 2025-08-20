import { useStockfish } from "../hooks/useStockfish";

export const Analysis = () => {
  const { enabled, startEngine, stopEngine, lines } = useStockfish();

  return (
    <div className="p-4 space-y-4">
      {/* Toggle button */}
      <button
        onClick={enabled ? stopEngine : startEngine}
        className={`px-4 py-2 rounded ${
          enabled ? "bg-red-600" : "bg-green-600"
        } text-white`}
      >
        {enabled ? "Disable Engine" : "Enable Engine"}
      </button>

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
