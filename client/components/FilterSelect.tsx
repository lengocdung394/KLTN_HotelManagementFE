import type { SelectHTMLAttributes } from "react";

type FilterSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

export default function FilterSelect({
  className = "",
  wrapperClassName = "",
  value,
  ...props
}: FilterSelectProps) {
  return <div className={`relative ${wrapperClassName}`}>
    <select {...props} value={value} className={className} />
  </div>;
}
