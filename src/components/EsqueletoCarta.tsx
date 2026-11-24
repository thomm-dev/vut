/** Esqueleto da carta com os slots piscando — o teatro do estado 2. */
export function EsqueletoCarta() {
  return (
    <div
      className="relative w-full overflow-hidden border border-[var(--line2)] bg-[#0b0d10]"
      style={{ aspectRatio: '600 / 840' }}
      aria-hidden
    >
      {/* As porcentagens espelham as coordenadas de carta.tsx no viewBox 600x840,
          senao o esqueleto promete uma carta diferente da que chega. */}
      {/* overall — 26,22 90x78 */}
      <div className="pulsa absolute left-[4.33%] top-[2.62%] h-[9.29%] w-[15%] rounded-[6px] bg-[var(--line2)]" />
      {/* marca do VUT — 35,120 88x34 */}
      <div className="pulsa absolute left-[5.83%] top-[14.29%] h-[4.05%] w-[14.67%] rounded-[3px] bg-[var(--line2)]" />
      {/* agente — 484,25 72x72 */}
      <div className="pulsa absolute left-[80.67%] top-[2.98%] h-[8.57%] w-[12%] rounded-[5px] bg-[var(--line2)]" />
      {/* rank — 486,109 68x68 */}
      <div className="pulsa absolute left-[81%] top-[12.98%] h-[8.1%] w-[11.33%] rounded-full bg-[var(--line2)]" />
      {/* personagem */}
      <div className="pulsa absolute left-1/2 top-[28%] h-[21%] w-[25%] -translate-x-1/2 rounded-full bg-[var(--line2)]" />
      <div
        className="pulsa absolute left-1/2 top-[52%] h-[20%] w-[50%] -translate-x-1/2 bg-[var(--line2)]"
        style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }}
      />
      {/* nome */}
      <div className="pulsa absolute left-1/2 top-[76%] h-[3.6%] w-[42%] -translate-x-1/2 rounded-[3px] bg-[var(--line2)]" />
      {/* divisor */}
      <div className="absolute left-[7%] top-[82.9%] h-px w-[86%] bg-[var(--line)]" />
      {/* stats */}
      <div className="absolute inset-x-[8%] top-[85.5%] grid grid-cols-2 gap-x-[6%] gap-y-[14px]">
        <div className="pulsa h-[14px] rounded-[2px] bg-[var(--line2)]" />
        <div className="pulsa h-[14px] rounded-[2px] bg-[var(--line2)]" />
        <div className="pulsa h-[14px] rounded-[2px] bg-[var(--line2)]" />
        <div className="pulsa h-[14px] rounded-[2px] bg-[var(--line2)]" />
      </div>
    </div>
  )
}
