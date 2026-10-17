'use client';

import { Badge, CheckIcon, Group, Select } from '@mantine/core';
import type { Tag } from '@/lib/types';

interface Props {
  tags: Tag[];
  /** Apenas uma tag: lista com 0 ou 1 id. */
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  error?: React.ReactNode;
}

/** Seleção de uma única tag, com opções (e a tag escolhida) no formato de selo colorido. */
export function TagSelect({ tags, value, onChange, label = 'Tag', error }: Props) {
  const selectedId = value[0] ?? null;
  const selected = tags.find((t) => t.id === selectedId) ?? null;
  const showBadge = !!selected;

  return (
    <Select
      label={label}
      placeholder={tags.length ? 'Selecione a tag' : 'Crie tags na aba Tags'}
      data={tags.map((t) => ({ value: t.id, label: t.name }))}
      clearable
      value={selectedId}
      onChange={(v) => onChange(v ? [v] : [])}
      error={error}
      // A tag escolhida aparece como selo dentro do campo.
      leftSection={
        showBadge ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', paddingInlineStart: 12 }}>
            <Badge color={selected.color} variant="light" size="sm">
              {selected.name}
            </Badge>
          </div>
        ) : undefined
      }
      leftSectionWidth={showBadge ? 'calc(100% - 44px)' : undefined}
      leftSectionPointerEvents="none"
      styles={{ input: showBadge ? { color: 'transparent' } : undefined }}
      renderOption={({ option, checked }) => (
        <Group flex={1} gap="xs" wrap="nowrap">
          {checked && <CheckIcon size={12} style={{ opacity: 0.4, color: 'var(--mantine-color-text)' }} />}
          <Badge color={tags.find((t) => t.id === option.value)?.color} variant="light" size="sm">
            {option.label}
          </Badge>
        </Group>
      )}
    />
  );
}
