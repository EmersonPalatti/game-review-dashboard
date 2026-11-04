import type { IconNode } from 'lucide';

type RailIconProps = {
  icon: IconNode;
  className?: string;
};

export function RailIcon({ icon, className = 'sidebar-icon' }: RailIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {icon.map(([tag, attrs], index) => {
        const Tag = tag as keyof React.JSX.IntrinsicElements;
        const { key: _key, ...rest } = attrs;
        return <Tag key={String(_key ?? `${tag}-${index}`)} {...rest} />;
      })}
    </svg>
  );
}
