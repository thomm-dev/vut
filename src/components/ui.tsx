import type { ReactNode } from 'react'

export function Painel({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`painel ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function Rotulo({
  children,
  tom = 'dim',
  className = '',
}: {
  children: ReactNode
  tom?: 'dim' | 'ok' | 'warn' | 'erro'
  className?: string
}) {
  const t = tom === 'dim' ? '' : `rotulo-${tom}`
  return <span className={`rotulo ${t} ${className}`}>{children}</span>
}

/** Faixa de KPIs do topo — atualiza ao vivo durante a busca. */
export function Kpi({
  rotulo,
  valor,
  sub,
  cor,
}: {
  rotulo: string
  valor: ReactNode
  sub?: ReactNode
  cor?: string
}) {
  return (
    <div className="relative border-b border-r border-[var(--line)] px-3 py-3 last:border-r-0 sm:px-4 sm:py-4">
      <Rotulo>{rotulo}</Rotulo>
      <div
        className="mt-2 truncate font-mono text-[18px] leading-none font-bold tabular-nums sm:text-[19px]"
        style={cor ? { color: cor } : undefined}
      >
        {valor}
      </div>
      {sub ? (
        <div className="mt-1.5 truncate font-mono text-[10px] text-[var(--dim)]">{sub}</div>
      ) : null}
    </div>
  )
}

export function Marca() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid h-6 w-6 place-items-center italic font-mono font-black text-[16px]">
        VUT
      </span>
    </span>
  )
}
