interface MaskedDomainProps {
  name: string;
}

export default function MaskedDomain({ name }: MaskedDomainProps) {
  const hasMask = name.includes('*');

  return (
    <span className={`font-mono text-sm ${hasMask ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
      {name}
    </span>
  );
}
