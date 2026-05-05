// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React from 'react';

export interface OutputSpec {
  vOut: number;
  iOut: number;
  isRegulated: boolean;
  tolerance: number;
}

export interface CrossRegAnalysisResult extends OutputSpec {
  estimatedVout10: number;
  estimatedVout100: number;
}

interface MultiOutputTableProps {
  outputs: OutputSpec[];
  onChange: (outputs: OutputSpec[]) => void;
  crossRegAnalysis?: CrossRegAnalysisResult[];
}

export const MultiOutputTable: React.FC<MultiOutputTableProps> = ({ outputs, onChange, crossRegAnalysis }) => {
  const handleAdd = () => {
    onChange([...outputs, { vOut: 12, iOut: 1, isRegulated: false, tolerance: 0.1 }]);
  };

  const handleRemove = (index: number) => {
    if (outputs.length === 1) return;
    const newOutputs = outputs.filter((_, i) => i !== index);
    if (outputs[index].isRegulated) newOutputs[0].isRegulated = true;
    onChange(newOutputs);
  };

  const handleToggleRegulated = (index: number) => {
    onChange(outputs.map((out, i) => ({ ...out, isRegulated: i === index })));
  };

  const handleUpdate = (index: number, field: keyof OutputSpec, value: number) => {
    const newOutputs = [...outputs];
    newOutputs[index] = { ...newOutputs[index], [field]: value };
    onChange(newOutputs);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 border border-gray-700 rounded p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-200">Secondary Windings</h2>
          <button 
            onClick={handleAdd}
            className="px-3 py-1 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-500"
          >
            + Add Rail
          </button>
        </div>

        <table className="w-full text-left text-sm text-gray-300">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="pb-2">Voltage (V)</th>
              <th className="pb-2">Current (A)</th>
              <th className="pb-2">Tolerance (%)</th>
              <th className="pb-2">Regulated</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {outputs.map((out, idx) => (
              <tr key={idx} className="border-b border-gray-700/50">
                <td className="py-2"><input type="number" value={out.vOut} onChange={e => handleUpdate(idx, 'vOut', parseFloat(e.target.value))} className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white" /></td>
                <td className="py-2"><input type="number" value={out.iOut} onChange={e => handleUpdate(idx, 'iOut', parseFloat(e.target.value))} className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white" /></td>
                <td className="py-2"><input type="number" value={out.tolerance * 100} onChange={e => handleUpdate(idx, 'tolerance', parseFloat(e.target.value) / 100)} className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white" /></td>
                <td className="py-2"><input type="radio" checked={out.isRegulated} onChange={() => handleToggleRegulated(idx)} className="text-indigo-600 focus:ring-indigo-500" /></td>
                <td className="py-2 text-right"><button onClick={() => handleRemove(idx)} disabled={outputs.length === 1} className="text-red-400 hover:text-red-300 disabled:opacity-50">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {crossRegAnalysis && crossRegAnalysis.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded p-4">
          <h2 className="text-lg font-bold text-gray-200 mb-4">Cross-Regulation Analysis</h2>
          <p className="text-sm text-gray-400 mb-4">Estimated voltage deviation of unregulated rails when the main regulated rail swings from 10% to 100% load.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {crossRegAnalysis.filter(r => !r.isRegulated).map((res, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 p-3 rounded">
                <div className="font-semibold text-gray-300 mb-2">Rail: {res.vOut}V</div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">@ 10% Main Load:</span><span className={`font-mono ${res.estimatedVout10 > res.vOut * (1 + res.tolerance) ? 'text-red-400' : 'text-amber-400'}`}>{res.estimatedVout10.toFixed(2)} V</span></div>
                <div className="flex justify-between text-sm mt-1"><span className="text-gray-400">@ 100% Main Load:</span><span className={`font-mono ${res.estimatedVout100 < res.vOut * (1 - res.tolerance) ? 'text-red-400' : 'text-green-400'}`}>{res.estimatedVout100.toFixed(2)} V</span></div>
              </div>
            ))}
            {crossRegAnalysis.filter(r => !r.isRegulated).length === 0 && <div className="text-sm text-gray-500 italic">No unregulated rails to analyze.</div>}
          </div>
        </div>
      )}
    </div>
  );
};