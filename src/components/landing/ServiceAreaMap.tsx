import { Section } from '@/components/ui/Section';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { landing } from '@/content/landing';
import { mapCopy, regionStyle } from '@/config/service-area';
import { buildMap, regionSummaries } from '@/lib/service-map';
import { MapTooltip } from './MapTooltip';
import { ZipCheckBox } from './ZipCheckBox';

// Server component: the SVG is fully rendered on the server, so it works without JavaScript.
export function ServiceAreaMap() {
  const s = landing.serviceArea;
  const map = buildMap();
  const regions = regionSummaries();

  return (
    <Section id="service-area" tone="navy">
      <SectionHeading title={s.heading} intro={s.body} light />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="rounded-2xl bg-white p-3 text-ink shadow-lg sm:p-5">
          <MapTooltip>
            <svg
              viewBox={map.viewBox}
              role="group"
              aria-label={mapCopy.mapLabel}
              className="block h-auto w-full"
              fontFamily="var(--font-inter), system-ui, sans-serif"
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0L10 5L0 10z" fill="#0E1A2B" />
                </marker>
              </defs>
              <g stroke="#fff" strokeWidth="1.2" strokeLinejoin="round">
                {map.states.map((st) => (
                  <path
                    key={st.abbr}
                    d={st.d}
                    fill={st.fill}
                    className={st.region ? 'map-state' : undefined}
                    {...(st.tooltip
                      ? {
                          tabIndex: 0,
                          role: 'img',
                          'aria-label': st.tooltip,
                          'data-tip': st.tooltip,
                        }
                      : { 'aria-hidden': true })}
                  />
                ))}
              </g>
              {(['west', 'east'] as const).map((r) => (
                <g
                  key={r}
                  fill={regionStyle[r].dot}
                  fillOpacity="0.62"
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  {map.dots[r].map((d, i) => (
                    <circle key={i} cx={d.x} cy={d.y} r={d.r} />
                  ))}
                </g>
              ))}
              <g aria-hidden="true" pointerEvents="none">
                <path
                  d={map.arc.d}
                  fill="none"
                  stroke="#0E1A2B"
                  strokeWidth="3"
                  strokeDasharray="9 7"
                  markerStart="url(#arrow)"
                  markerEnd="url(#arrow)"
                />
                <text
                  x={map.arc.labelAt[0]}
                  y={map.arc.labelAt[1]}
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="700"
                  fill="#0E1A2B"
                  stroke="#fff"
                  strokeWidth="5"
                  paintOrder="stroke"
                >
                  {mapCopy.arcLabel}
                </text>
                {map.metroLabels.map((m) => (
                  <text
                    key={m.name}
                    x={m.x}
                    y={m.y}
                    textAnchor={m.anchor}
                    fontSize="21"
                    fontWeight="700"
                    fill="#17304F"
                    stroke="#fff"
                    strokeWidth="4"
                    paintOrder="stroke"
                  >
                    {m.lines.map((line, i) => (
                      <tspan key={line} x={m.x} dy={i === 0 ? 0 : 22}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                ))}
                {map.regionLabels.map((l) => (
                  <text
                    key={l.text}
                    className="sm:hidden"
                    x={l.x}
                    y={l.y}
                    textAnchor="middle"
                    fontSize="34"
                    fontWeight="800"
                    letterSpacing="2"
                    fill={regionStyle[l.region].text}
                    stroke="#fff"
                    strokeWidth="6"
                    paintOrder="stroke"
                  >
                    {l.text}
                  </text>
                ))}
                {map.stateLabels.map((l) => (
                  <text
                    className="max-sm:hidden"
                    key={l.abbr}
                    x={l.x}
                    y={l.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="18"
                    fontWeight="700"
                    fill="#0E1A2B"
                    stroke="#fff"
                    strokeWidth="3.5"
                    paintOrder="stroke"
                  >
                    {l.abbr}
                  </text>
                ))}
                <g transform={`translate(${map.terminal.x} ${map.terminal.y})`}>
                  <path
                    d="M0 0C-11-14-13-22-13-27a13 13 0 0 1 26 0C13-22 11-14 0 0z"
                    fill="#F5A524"
                    stroke="#0E1A2B"
                    strokeWidth="2.5"
                  />
                  <circle cy="-27" r="5" fill="#0E1A2B" />
                </g>
              </g>
            </svg>
          </MapTooltip>

          <ul className="mt-3 flex flex-col gap-2 text-sm font-semibold sm:flex-row sm:flex-wrap sm:gap-x-6">
            {(['west', 'east'] as const).map((r) => (
              <li key={r} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ background: regionStyle[r].dot }}
                />
                {regionStyle[r].label}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <svg aria-hidden="true" width="14" height="20" viewBox="-14 -30 28 32">
                <path
                  d="M0 0C-11-14-13-22-13-27a13 13 0 0 1 26 0C13-22 11-14 0 0z"
                  fill="#F5A524"
                  stroke="#0E1A2B"
                  strokeWidth="3"
                />
              </svg>
              {mapCopy.terminalLabel}
            </li>
          </ul>
          <p className="mt-2 text-sm text-muted">{mapCopy.legendNote}</p>

          <div className="sr-only">
            <h3>Regions we serve</h3>
            <ul>
              {regions.map((r) => (
                <li key={r.region}>
                  {r.label}:{' '}
                  {r.region === 'west' ? `${mapCopy.westMetroSummary}. States: ` : 'States: '}
                  {r.states.join(', ')}.
                </li>
              ))}
            </ul>
            <p>{mapCopy.legendNote}</p>
          </div>
        </div>
        <ZipCheckBox />
      </div>
    </Section>
  );
}
