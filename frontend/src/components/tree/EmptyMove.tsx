function EmptyMove({ conceal }: { conceal?: string }) {
  const className = conceal ? conceal : '';
  return <div className={className}>...</div>;
}
