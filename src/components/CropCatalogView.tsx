import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ABIOTIC_CONDITIONS_CATALOG, CROPS_KNOWLEDGE_BASE } from '../data/cropsKnowledgeBase';

export const CropCatalogView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedCropId, setSelectedCropId] = useState<string>('abiotic_causes');

  const filteredCrops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CROPS_KNOWLEDGE_BASE;
    return CROPS_KNOWLEDGE_BASE.filter(
      (crop) =>
        crop.commonName.toLowerCase().includes(q) ||
        crop.scientificName.toLowerCase().includes(q) ||
        crop.conditions.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.scientificName.toLowerCase().includes(q)
        )
    );
  }, [query]);

  const filteredAbiotic = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ABIOTIC_CONDITIONS_CATALOG;
    return ABIOTIC_CONDITIONS_CATALOG.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.scientificName.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q)
    );
  }, [query]);

  const showAbiotic =
    selectedCropId === 'abiotic_causes' ||
    (filteredCrops.length === 0 && filteredAbiotic.length > 0);

  const activeCrop = showAbiotic
    ? null
    : filteredCrops.find((c) => c.id === selectedCropId) ?? filteredCrops[0] ?? CROPS_KNOWLEDGE_BASE[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#182019] text-balance">
            30 Crops &amp; 9 Water, Sun, Soil &amp; Fertilizer Guides
          </h1>
          <p className="mt-1 text-sm text-[#475449]">
            Stored right on the phone for offline checking across 30 Southeast Asian crops plus lack of water, too much water, too little sun, fertilizer burn, weak soil, heat, weedkiller drift, salty soil, and storm damage.
          </p>
        </div>

        <label className="relative block w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A675C]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search crop, pest, or problem..."
            className="min-h-[44px] w-full rounded-xl border border-[#D4DBD0] bg-white pl-9 pr-3 text-sm text-[#182019] placeholder:text-[#7A877B] focus:border-[#1B5E20] focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Selector List */}
        <div className="space-y-1.5 lg:col-span-4">
          <button
            type="button"
            onClick={() => setSelectedCropId('abiotic_causes')}
            className={`flex min-h-[52px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition-colors ${
              showAbiotic
                ? 'border-[#B45309] bg-amber-50 text-[#78350F]'
                : 'border-[#E2E6DF] bg-white text-[#182019] hover:bg-[#F3F5F0]'
            }`}
          >
            <div>
              <p className="text-sm font-semibold">Water, Sun, Soil &amp; Fertilizer</p>
              <p className="text-xs italic text-[#5A675C]">
                Dry soil, too much water, shade, fertilizer, salt
              </p>
            </div>
            <span className="font-mono-tabular text-xs text-[#5A675C]">
              {filteredAbiotic.length} guides
            </span>
          </button>

          {filteredCrops.map((crop) => {
            const active = !showAbiotic && activeCrop?.id === crop.id;
            return (
              <button
                key={crop.id}
                type="button"
                onClick={() => setSelectedCropId(crop.id)}
                className={`flex min-h-[52px] w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-[#1B5E20] bg-[#EBF3EB] text-[#14532D]'
                    : 'border-[#E2E6DF] bg-white text-[#182019] hover:bg-[#F3F5F0]'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{crop.commonName}</p>
                </div>
                <span className="font-mono-tabular text-xs text-[#5A675C]">
                  {crop.conditions.length} guides
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Panel */}
        {showAbiotic ? (
          <div className="space-y-4 lg:col-span-8">
            <div className="rounded-2xl border border-[#DCE2D7] bg-white p-5">
              <div className="border-b border-[#ECEFE9] pb-3">
                <h2 className="text-xl font-bold text-[#182019]">
                  Water, Sun, Soil, or Fertilizer Problems (Not Bugs)
                </h2>
                <p className="mt-0.5 text-xs text-[#5A675C]">
                  Checked offline for all 30 crops whenever water, shade, soil, fertilizer, or weather matches.
                </p>
              </div>

              <div className="mt-4 divide-y divide-[#ECEFE9]">
                {filteredAbiotic.map((cond) => (
                  <article key={cond.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-semibold text-[#182019]">{cond.name}</h3>
                      <span className="text-xs font-medium text-[#B45309]">Water / Soil / Sun</span>
                    </div>
                    <p className="mt-2 text-sm text-[#2C372E]">{cond.summary}</p>
                    <p className="mt-2 text-xs text-[#475449]">
                      <span className="font-semibold text-[#182019]">What to do: </span>
                      {cond.recommendations.immediateActions[0]}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : activeCrop ? (
          <div className="space-y-4 lg:col-span-8">
            <div className="rounded-2xl border border-[#DCE2D7] bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#ECEFE9] pb-3">
                <div>
                  <h2 className="text-xl font-bold text-[#182019]">
                    {activeCrop.commonName}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#5A675C]">
                    Where grown: {activeCrop.globalRegions}
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-[#ECEFE9]">
                {activeCrop.conditions.map((cond) => (
                  <article key={cond.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-semibold text-[#182019]">{cond.name}</h3>
                      <span className="text-xs font-medium text-[#5A675C]">{cond.category}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#2C372E]">{cond.summary}</p>
                    <p className="mt-2 text-xs text-[#475449]">
                      <span className="font-semibold text-[#182019]">What to do: </span>
                      {cond.recommendations.immediateActions[0]}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
