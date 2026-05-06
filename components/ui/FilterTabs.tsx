"use client";

interface FilterTabsProps {
  // Industry L1
  industryL1Options: string[];
  selectedL1: string | null;
  onL1Change: (value: string | null) => void;

  // Industry L2 (cascaded from L1)
  industryL2Options: string[];
  selectedL2: string | null;
  onL2Change: (value: string | null) => void;

  // Competition relation (multi-select)
  competitionRelationOptions: string[];
  selectedRelations: string[];
  onRelationsChange: (values: string[]) => void;

  // MDS related (single-select)
  mdsRelatedOptions: string[];
  selectedMds: string | null;
  onMdsChange: (value: string | null) => void;

  isLoading?: boolean;
}

const ALL = "全部";

function Pill({
  label,
  isSelected,
  onClick,
  disabled,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 px-3 rounded-full text-sm cursor-pointer transition-[background,border-color] duration-100 ease
        ${
          isSelected
            ? "bg-accent-surface border border-accent text-green-700 font-semibold"
            : "bg-white border border-border text-gray-700 hover:bg-surface"
        }
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
      `}
    >
      {label}
    </button>
  );
}

export default function FilterTabs({
  industryL1Options,
  selectedL1,
  onL1Change,
  industryL2Options,
  selectedL2,
  onL2Change,
  competitionRelationOptions,
  selectedRelations,
  onRelationsChange,
  mdsRelatedOptions,
  selectedMds,
  onMdsChange,
  isLoading = false,
}: FilterTabsProps) {
  // Row 1: single-select industry_l1
  const handleL1Click = (value: string) => {
    if (value === ALL) {
      onL1Change(null);
      onL2Change(null);
    } else if (value === selectedL1) {
      // Deselect (toggle off)
      onL1Change(null);
      onL2Change(null);
    } else {
      onL1Change(value);
      onL2Change(null); // Clear l2 when l1 changes
    }
  };

  // Row 1b: single-select industry_l2
  const handleL2Click = (value: string) => {
    if (value === selectedL2) {
      onL2Change(null);
    } else {
      onL2Change(value);
    }
  };

  // Row 2: multi-select competition_relation
  const handleRelationClick = (value: string) => {
    if (value === ALL) {
      onRelationsChange([]);
    } else {
      const current = selectedRelations.filter((r) => r !== ALL);
      if (current.includes(value)) {
        const next = current.filter((r) => r !== value);
        onRelationsChange(next.length === 0 ? [] : next);
      } else {
        const next = [...current, value];
        onRelationsChange(next);
      }
    }
  };

  // Row 3: single-select mds_related
  const handleMdsClick = (value: string) => {
    if (value === ALL) {
      onMdsChange(null);
    } else {
      // Clicking selected pill is no-op (must have a selection)
      onMdsChange(value);
    }
  };

  const hasActiveL1 = selectedL1 !== null;
  const isAllRelations =
    selectedRelations.length === 0;
  const isAllMds = selectedMds === null;

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {/* Row 1: 行业分类 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-normal text-gray-500 w-20 flex-shrink-0">
          行业分类
        </span>
        {isLoading && industryL1Options.length === 0 ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-16 bg-gray-200 rounded-full animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* 全部 pill for l1 */}
            <Pill
              key={ALL}
              label={ALL}
              isSelected={!hasActiveL1}
              onClick={() => handleL1Click(ALL)}
              disabled={isLoading}
            />
            {industryL1Options.map((opt) => (
              <Pill
                key={opt}
                label={opt}
                isSelected={selectedL1 === opt}
                onClick={() => handleL1Click(opt)}
                disabled={isLoading}
              />
            ))}
          </>
        )}
      </div>

      {/* Row 1b: industry_l2 sub-pills (only when l1 is selected) */}
      {hasActiveL1 && (
        <div className="flex items-center gap-2 flex-wrap pl-20">
          {industryL2Options.map((opt) => (
            <Pill
              key={opt}
              label={opt}
              isSelected={selectedL2 === opt}
              onClick={() => handleL2Click(opt)}
              disabled={isLoading}
            />
          ))}
          {industryL2Options.length === 0 && !isLoading && (
            <span className="text-xs text-gray-400">暂无二级分类</span>
          )}
        </div>
      )}

      {/* Row 2: 竞争关系 (multi-select) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-normal text-gray-500 w-20 flex-shrink-0">
          竞争关系
        </span>
        <Pill
          label={ALL}
          isSelected={isAllRelations}
          onClick={() => handleRelationClick(ALL)}
          disabled={isLoading}
        />
        {competitionRelationOptions.map((opt) => (
          <Pill
            key={opt}
            label={opt}
            isSelected={selectedRelations.includes(opt)}
            onClick={() => handleRelationClick(opt)}
            disabled={isLoading}
          />
        ))}
      </div>

      {/* Row 3: MDS 相关性 (single-select) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-normal text-gray-500 w-20 flex-shrink-0">
          MDS 相关性
        </span>
        <Pill
          label={ALL}
          isSelected={isAllMds}
          onClick={() => handleMdsClick(ALL)}
          disabled={isLoading}
        />
        {mdsRelatedOptions.map((opt) => (
          <Pill
            key={opt}
            label={opt}
            isSelected={selectedMds === opt}
            onClick={() => handleMdsClick(opt)}
            disabled={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
