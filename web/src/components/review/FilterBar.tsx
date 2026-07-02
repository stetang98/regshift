import './review.css';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterGroup {
  label: string;
  value: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
}

export function FilterBar({ groups }: { groups: FilterGroup[] }) {
  return (
    <div className="filter-bar">
      {groups.map((group) => (
        <div key={group.label} className="filter-group" role="group" aria-label={`Filter by ${group.label}`}>
          <span className="section-label">{group.label}</span>
          <div className="filter-chips">
            {group.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`filter-chip${group.value === option.value ? ' is-active' : ''}`}
                aria-pressed={group.value === option.value}
                onClick={() => group.onSelect(option.value)}
              >
                {option.label} <span className="chip-count">{option.count}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
