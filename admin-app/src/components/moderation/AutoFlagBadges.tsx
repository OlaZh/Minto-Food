import { type AutoFlag } from '@/lib/autoFlag'

const FLAG_STYLES: Record<string, string> = {
  inappropriate: 'bg-red-50 text-red-600 border-red-200',
  suspicious_link: 'bg-orange-50 text-orange-600 border-orange-200',
}

export default function AutoFlagBadges({ flags }: { flags: AutoFlag[] }) {
  if (!flags.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {flags.map((flag, i) => (
        <span
          key={i}
          className={`text-xs px-1.5 py-0.5 rounded border font-medium ${FLAG_STYLES[flag.type]}`}
          title="Автоматичний флаг — перевір вручну"
        >
          {flag.label}
        </span>
      ))}
    </div>
  )
}
