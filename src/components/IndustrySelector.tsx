"use client";

import { useState } from "react";
import { INDUSTRIES } from "@/lib/constants/industries";

interface IndustrySelectorProps {
  defaultValues?: string[];
  name?: string;
}

export function IndustrySelector({ defaultValues = [], name = "industries" }: IndustrySelectorProps) {
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(defaultValues);

  const toggleIndustry = (value: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  return (
    <div>
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(selectedIndustries)}
      />

      <div className="flex flex-wrap gap-2.5">
        {INDUSTRIES.map((industry) => {
          const isSelected = selectedIndustries.includes(industry.value);

          return (
            <button
              key={industry.value}
              type="button"
              onClick={() => toggleIndustry(industry.value)}
              className={`
                px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                }
              `}
            >
              {industry.label}
            </button>
          );
        })}
      </div>

      {selectedIndustries.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
          <span className="font-medium">選択中:</span>
          <div className="flex flex-wrap gap-1">
            {selectedIndustries.map((value) => {
              const industry = INDUSTRIES.find((i) => i.value === value);
              return (
                <span
                  key={value}
                  className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md"
                >
                  {industry?.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
