import * as Lib from "metabase-lib";
import { getUniqueExpressionName } from "metabase-lib/v1/queries/utils/expression";

import S from "../../SummarySidebar.module.css";
import type { SummaryDimensionItem } from "../../types";
import { FormulaChip } from "../FormulaChip";
import { WellChip } from "../WellChip";

type DimensionChipProps = {
  query: Lib.Query;
  stageIndex: number;
  item: SummaryDimensionItem;
  onChange: (nextQuery: Lib.Query) => void;
  onRemove: () => void;
  onFocusInput: () => void;
};

export function DimensionChip({
  query,
  stageIndex,
  item,
  onChange,
  onRemove,
  onFocusInput,
}: DimensionChipProps) {
  const { expression } = item;
  if (expression) {
    const currentName = Lib.displayInfo(
      query,
      stageIndex,
      expression,
    ).displayName;
    const handleRename = (name: string) => {
      const uniqueName =
        name === currentName
          ? name
          : getUniqueExpressionName(query, stageIndex, name);
      let nextQuery = Lib.replaceClause(
        query,
        stageIndex,
        expression,
        Lib.withExpressionName(expression, uniqueName),
      );
      const bucket = Lib.temporalBucket(item.clause);
      const binning = Lib.binning(item.clause);
      if (bucket || binning) {
        // Replacing an expression drops options on its breakout reference.
        const index = Lib.breakouts(query, stageIndex).indexOf(item.clause);
        const breakout = Lib.breakouts(nextQuery, stageIndex)[index];
        const column =
          breakout && Lib.breakoutColumn(nextQuery, stageIndex, breakout);
        if (column) {
          nextQuery = Lib.replaceClause(
            nextQuery,
            stageIndex,
            breakout,
            Lib.withTemporalBucket(Lib.withBinning(column, binning), bucket),
          );
        }
      }
      onChange(nextQuery);
    };
    return (
      <FormulaChip
        label={item.label}
        name={currentName}
        onRename={handleRename}
        onRemove={onRemove}
        onFocusInput={onFocusInput}
      />
    );
  }
  return (
    <WellChip label={item.label} onRemove={onRemove}>
      <span className={S.chipLabel}>{item.label}</span>
    </WellChip>
  );
}
