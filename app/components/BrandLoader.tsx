export function BrandLoader({ label }: { label?: string }) {
  return (
    <div className="brand-loader" role={label ? 'status' : undefined}>
      <span className="brand-loader-spin" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {label ? <p>{label}</p> : null}
    </div>
  );
}
