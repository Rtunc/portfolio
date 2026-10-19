import { useEffect, useState } from 'react';
import { pathForks, pathStages } from '../data/platform';

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [query]);
  return matches;
}

function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function Packets({ pathId, dur, begin, radius, fill, motion, trail = true }: { pathId: string; dur: string; begin: string; radius: number; fill: string; motion: boolean; trail?: boolean }) {
  if (!motion) return null;
  const beads = trail
    ? [
        { r: radius, opacity: 1, lag: begin },
        { r: radius * 0.62, opacity: 0.45, lag: '0.32s' },
      ]
    : [{ r: radius, opacity: 1, lag: begin }];
  return (
    <>
      {beads.map((bead) => (
        <circle key={bead.lag} className="flow-packet" r={bead.r} fill={fill} opacity={bead.opacity}>
          <animateMotion dur={dur} begin={bead.lag} repeatCount="indefinite" calcMode="linear">
            <mpath xlinkHref={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  );
}

function StageCopy({ x, y, body, anchor = 'middle', max = 22 }: { x: number; y: number; body: string; anchor?: 'middle' | 'start'; max?: number }) {
  const lines = wrap(body, max);
  return (
    <text x={x} y={y} textAnchor={anchor} fill="#5c564e" fontSize="11">
      {lines.map((line, index) => (
        <tspan key={`${index}-${line}`} x={x} dy={index === 0 ? 0 : 14}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function LineagePath({ mode }: { mode: 'page' | 'report' }) {
  const motion = !useMedia('(prefers-reduced-motion: reduce)');
  const narrow = useMedia('(max-width: 800px)');
  const page = mode === 'page';
  const label = page
    ? 'Postgres to CDC to Raw to Glue, then DWH for custom dashboards or a curated schema for embedded dashboards'
    : 'Where this number comes from: Postgres, CDC, Raw, Glue, then DWH. Curated schema is the other branch.';

  return (
    <div className={page ? 'flow' : 'flow flow-report'}>
      {page ? null : <p className="flow-title">Where this number comes from</p>}
      {narrow ? <NarrowRoute mode={mode} motion={motion} label={label} /> : <WideRoute mode={mode} motion={motion} label={label} />}
      <ol className="sr-only" aria-label={page ? 'Platform path' : 'Where this number comes from'}>
        {pathStages.map((stage) => (
          <li key={stage.id}>{`${stage.name}. ${stage.body}`}</li>
        ))}
        {pathForks.map((fork) => (
          <li key={fork.id}>{`${fork.name}. ${fork.body}`}</li>
        ))}
      </ol>
    </div>
  );
}

function WideRoute({ mode, motion, label }: { mode: 'page' | 'report'; motion: boolean; label: string }) {
  const page = mode === 'page';
  const width = page ? 1080 : 640;
  const height = page ? 236 : 140;
  const spineY = page ? 64 : 58;
  const stageX = page ? [92, 248, 404, 560] : [44, 118, 192, 266];
  const forkX = page ? 640 : 318;
  const dwh = page ? { x: 812, y: 36 } : { x: 430, y: 28 };
  const curated = page ? { x: 812, y: 168 } : { x: 430, y: 96 };
  const dwhPath = `M ${stageX[0]} ${spineY} H ${forkX} C ${forkX + 64} ${spineY}, ${dwh.x - 72} ${dwh.y}, ${dwh.x} ${dwh.y}`;
  const curatedPath = `M ${forkX} ${spineY} C ${forkX + 64} ${spineY}, ${curated.x - 72} ${curated.y}, ${curated.x} ${curated.y}`;
  const dwhId = `${mode}-dwh`;
  const curatedId = `${mode}-curated`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={label}>
      <path d={dwhPath} fill="none" stroke="#e4ddd2" strokeWidth="6" strokeLinecap="round" />
      <path d={curatedPath} fill="none" stroke="#e4ddd2" strokeWidth="6" strokeLinecap="round" />
      <path id={dwhId} className={motion ? 'flow-live' : undefined} d={dwhPath} fill="none" stroke="#005b82" strokeWidth="2.5" strokeLinecap="round" />
      <path id={curatedId} d={curatedPath} fill="none" stroke="#b7b1a8" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 7" />
      {stageX.map((x) => (
        <circle key={x} cx={x} cy={spineY} r="6" fill="#fff" stroke="#005b82" strokeWidth="2" />
      ))}
      <circle className={motion ? 'flow-here' : undefined} cx={dwh.x} cy={dwh.y} r="8" fill="#005b82" />
      <circle cx={curated.x} cy={curated.y} r="6" fill="#fff" stroke="#b7b1a8" strokeWidth="2" />
      <Packets pathId={dwhId} dur="5.6s" begin="0s" radius={5} fill="#005b82" motion={motion} />
      <Packets pathId={curatedId} dur="6.4s" begin="0.9s" radius={4} fill="#8d877e" motion={motion} trail={false} />
      {pathStages.map((stage, index) => {
        const x = stageX[index] ?? 0;
        return (
          <g key={stage.id}>
            <text x={x} y={spineY - 28} textAnchor="middle" fill="#1c1915" fontSize={page ? 15 : 13} fontWeight="650">
              {stage.name}
            </text>
            <text x={x} y={spineY - 14} textAnchor="middle" fill="#6d6d6d" fontSize="11">
              {stage.kicker}
            </text>
            {page ? <StageCopy x={x} y={spineY + 22} body={stage.body} /> : null}
          </g>
        );
      })}
      <ForkText
        x={dwh.x + 16}
        y={dwh.y}
        name="DWH"
        kicker={pathForks[0].kicker}
        detail={page ? 'The demo reads this layer.' : pathForks[0].report}
        hot
      />
      <ForkText
        x={curated.x + 16}
        y={curated.y}
        name="Curated schema"
        kicker={pathForks[1].kicker}
        detail={page ? 'Inside the product.' : pathForks[1].report}
        hot={false}
      />
    </svg>
  );
}

function NarrowRoute({ mode, motion, label }: { mode: 'page' | 'report'; motion: boolean; label: string }) {
  const page = mode === 'page';
  const width = 340;
  const spineX = 18;
  const stageY = page ? [26, 124, 222, 320] : [22, 62, 102, 142];
  const forkY = page ? 418 : 168;
  const dwh = page ? { x: 100, y: 492 } : { x: 78, y: 210 };
  const curated = page ? { x: 246, y: 492 } : { x: 78, y: 262 };
  const height = page ? 572 : 304;
  const dwhPath = `M ${spineX} ${stageY[0]} V ${forkY} C ${spineX} ${forkY + 36}, ${dwh.x} ${dwh.y - 36}, ${dwh.x} ${dwh.y}`;
  const curatedPath = `M ${spineX} ${forkY} C ${spineX + 8} ${forkY + 28}, ${curated.x - 28} ${curated.y - 24}, ${curated.x} ${curated.y}`;
  const dwhId = `${mode}-dwh`;
  const curatedId = `${mode}-curated`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={label}>
      <path d={dwhPath} fill="none" stroke="#e4ddd2" strokeWidth="6" strokeLinecap="round" />
      <path d={curatedPath} fill="none" stroke="#e4ddd2" strokeWidth="6" strokeLinecap="round" />
      <path id={dwhId} className={motion ? 'flow-live' : undefined} d={dwhPath} fill="none" stroke="#005b82" strokeWidth="2.5" strokeLinecap="round" />
      <path id={curatedId} d={curatedPath} fill="none" stroke="#b7b1a8" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 7" />
      {stageY.map((y) => (
        <circle key={y} cx={spineX} cy={y} r="6" fill="#fff" stroke="#005b82" strokeWidth="2" />
      ))}
      <circle className={motion ? 'flow-here' : undefined} cx={dwh.x} cy={dwh.y} r="8" fill="#005b82" />
      <circle cx={curated.x} cy={curated.y} r="6" fill="#fff" stroke="#b7b1a8" strokeWidth="2" />
      <Packets pathId={dwhId} dur="5.6s" begin="0s" radius={5} fill="#005b82" motion={motion} />
      <Packets pathId={curatedId} dur="6.4s" begin="0.9s" radius={4} fill="#8d877e" motion={motion} trail={false} />
      {pathStages.map((stage, index) => {
        const y = stageY[index] ?? 0;
        return (
          <g key={stage.id}>
            <text x={40} y={y + 4} fill="#1c1915" fontSize="14" fontWeight="650">
              {stage.name}
              <tspan fill="#6d6d6d" fontSize="11" fontWeight="500">{`  ${stage.kicker}`}</tspan>
            </text>
            {page ? <StageCopy x={40} y={y + 22} body={stage.body} anchor="start" max={44} /> : null}
          </g>
        );
      })}
      {page ? (
        <>
          <ForkText x={dwh.x} y={dwh.y + 28} name="DWH" kicker={pathForks[0].kicker} detail="The demo reads this layer." hot anchor="middle" />
          <ForkText x={curated.x} y={curated.y + 28} name="Curated schema" kicker={pathForks[1].kicker} detail="Inside the product." hot={false} anchor="middle" />
        </>
      ) : (
        <>
          <ForkText x={dwh.x + 16} y={dwh.y} name="DWH" kicker={pathForks[0].kicker} detail={pathForks[0].report} hot />
          <ForkText x={curated.x + 16} y={curated.y} name="Curated schema" kicker={pathForks[1].kicker} detail={pathForks[1].report} hot={false} />
        </>
      )}
    </svg>
  );
}

function ForkText({
  x,
  y,
  name,
  kicker,
  detail,
  hot,
  anchor = 'start',
}: {
  x: number;
  y: number;
  name: string;
  kicker: string;
  detail: string;
  hot: boolean;
  anchor?: 'start' | 'middle';
}) {
  const fill = hot ? '#005b82' : '#6d6d6d';
  return (
    <g>
      <text x={x} y={y - 4} textAnchor={anchor} fill={fill} fontSize="14" fontWeight="650">
        {name}
      </text>
      <text x={x} y={y + 12} textAnchor={anchor} fill={fill} fontSize="11">
        {kicker}
      </text>
      <text x={x} y={y + 26} textAnchor={anchor} fill={fill} fontSize="11">
        {detail}
      </text>
    </g>
  );
}
