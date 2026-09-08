export type DisplayOption = { value: string; label: string };

/** Unknown or no-longer-unlocked values must not expose internal IDs. */
export function optionLabel(options: readonly DisplayOption[], value: string) {
  return (
    options.find((option) => option.value === value)?.label ||
    (options.length ? '请选择' : '暂无可选项')
  );
}
