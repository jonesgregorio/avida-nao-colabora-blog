// Still-life editorial da hero: planta + xícara sobre livros, mesa clara.
// Ilustração vetorial na paleta da marca (off-white / verdes suaves / creme),
// fiel à composição dos prints de referência. Sem dependência de foto externa.
export default function HeroArt({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 400"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* sombra de chão suave */}
      <ellipse cx="228" cy="352" rx="150" ry="18" fill="#14281e" opacity="0.05" />

      {/* mesa clara (madeira suave) */}
      <path d="M20 322 H420 a10 10 0 0 1 10 10 v4 a6 6 0 0 1 -6 6 H16 a6 6 0 0 1 -6 -6 v-4 a10 10 0 0 1 10 -10 Z" fill="#EADBBF" />
      <rect x="10" y="336" width="420" height="8" rx="4" fill="#DCC9A5" />

      {/* ── Planta (atrás dos livros) ── */}
      <g>
        <path d="M150 262 C 146 200, 150 150, 150 78" stroke="#4A7A5E" strokeWidth="2.4" strokeLinecap="round" />
        {[
          { r: -46, ry: 46, fill: '#5C8A72' },
          { r: -28, ry: 66, fill: '#3F6F57' },
          { r: -10, ry: 80, fill: '#5C8A72' },
          { r: 8, ry: 78, fill: '#3F6F57' },
          { r: 26, ry: 62, fill: '#5C8A72' },
          { r: 44, ry: 44, fill: '#3F6F57' },
        ].map((l, i) => (
          <ellipse key={i} cx="150" cy="190" rx="11" ry={l.ry} fill={l.fill} transform={`rotate(${l.r} 150 256)`} />
        ))}
        {/* vasinho da planta espiando à esquerda */}
        <path d="M120 262 h60 l-8 40 a6 6 0 0 1 -6 5 h-32 a6 6 0 0 1 -6 -5 Z" fill="#E7DCC6" />
        <rect x="116" y="256" width="68" height="10" rx="5" fill="#F1EADB" />
      </g>

      {/* ── Pilha de livros ── */}
      <g>
        <rect x="96" y="286" width="248" height="34" rx="8" fill="#E7DCC6" />
        <rect x="96" y="308" width="248" height="12" rx="6" fill="#D8C9AC" />
        <rect x="110" y="256" width="220" height="34" rx="8" fill="#F1EADB" />
        <rect x="110" y="278" width="220" height="12" rx="6" fill="#E3D7BE" />
        {/* marcador de página */}
        <rect x="168" y="256" width="12" height="44" rx="2" fill="#D98A72" />
      </g>

      {/* ── Xícara ── */}
      <g>
        {/* alça */}
        <path d="M300 196 c 30 0, 30 44, 0 44" stroke="#E0D4BC" strokeWidth="13" fill="none" strokeLinecap="round" />
        <path d="M300 203 c 18 0, 18 30, 0 30" stroke="#EFE7D5" strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* corpo */}
        <path d="M204 190 h84 a6 6 0 0 1 6 6 v26 a48 48 0 0 1 -96 0 v-26 a6 6 0 0 1 6 -6 Z" fill="#EFE7D5" />
        <path d="M204 190 h84 a6 6 0 0 1 6 6 v10 a48 20 0 0 1 -96 0 v-10 a6 6 0 0 1 6 -6 Z" fill="#F4EEE1" />
        {/* boca da xícara */}
        <ellipse cx="246" cy="190" rx="48" ry="11" fill="#F6F0E4" />
        <ellipse cx="246" cy="190" rx="37" ry="7" fill="#E4D8C0" />
        {/* vapor */}
        <path d="M232 176 c -6 -8, 6 -14, 0 -24" stroke="#CBB89A" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <path d="M258 176 c -6 -8, 6 -14, 0 -24" stroke="#CBB89A" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        {/* pintinhas de cerâmica */}
        <g fill="#C9B79A">
          <circle cx="222" cy="214" r="1.5" />
          <circle cx="244" cy="224" r="1.4" />
          <circle cx="266" cy="210" r="1.5" />
          <circle cx="280" cy="222" r="1.3" />
          <circle cx="234" cy="232" r="1.4" />
          <circle cx="258" cy="236" r="1.3" />
        </g>
      </g>
    </svg>
  )
}
