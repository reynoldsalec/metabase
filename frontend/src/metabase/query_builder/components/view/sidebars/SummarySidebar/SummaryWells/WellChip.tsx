import cx from "classnames";
import type { ReactNode } from "react";
import { t } from "ttag";

import { ActionIcon, Box, Icon } from "metabase/ui";

import S from "../SummarySidebar.module.css";

type WellChipProps = {
  className?: string;
  label: string;
  children: ReactNode;
  onRemove: () => void;
};

export function WellChip({
  label,
  children,
  className,
  onRemove,
}: WellChipProps) {
  return (
    <Box className={cx(S.chip, className)} data-testid="summary-well-item">
      {children}
      <ActionIcon
        className={S.chipRemove}
        size="sm"
        variant="subtle"
        c="inherit"
        aria-label={t`Remove ${label}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRemove}
      >
        <Icon name="close" size={12} />
      </ActionIcon>
    </Box>
  );
}
