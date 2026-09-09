import type { ReactNode } from 'react';

type ItemKind =
  | 'resource'
  | 'material'
  | 'building'
  | 'equipment'
  | 'skill'
  | 'research';
type Props = { kind: ItemKind; id: string; size?: number; className?: string };

// Small, filled illustrations share a restrained enamel-and-wood palette.
// No external assets, text labels or document-wide SVG IDs are needed.
const C = {
  ink: '#26342e',
  shade: '#18251f',
  green: '#537660',
  leaf: '#7f9b6d',
  pale: '#c7d0aa',
  ivory: '#ecdfb7',
  gold: '#c9a35e',
  light: '#f6d893',
  brass: '#9e773f',
  wood: '#996d44',
  bark: '#614a33',
  stone: '#7d8f8b',
  steel: '#b7c8c3',
  blue: '#86a4b2',
  frost: '#d8e9df',
  ember: '#c77145',
  red: '#8f493e',
  violet: '#85799c',
  night: '#4c4d70',
};
const outline = {
  stroke: C.ink,
  strokeWidth: 0.9,
  strokeLinejoin: 'round' as const,
};

function Shadow() {
  return <ellipse cx="16" cy="28" rx="12" ry="2" fill={C.shade} opacity=".3" />;
}
function Spark({
  x = 24,
  y = 6,
  color = C.light,
}: {
  x?: number;
  y?: number;
  color?: string;
}) {
  return (
    <path
      d={`M${x} ${y - 3}l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z`}
      fill={color}
    />
  );
}
function Log({ ancient = false }: { ancient?: boolean }) {
  return (
    <g {...outline}>
      <path d="m4 17 14-9 10 6-14 9Z" fill={ancient ? C.green : C.wood} />
      <path d="m4 17 1 8 9 4v-6Z" fill={C.bark} />
      <path d="m14 23 14-9-1 8-13 7Z" fill={ancient ? '#355b47' : '#7f5838'} />
      <ellipse
        cx="8.8"
        cy="22"
        rx="3.3"
        ry="4"
        transform="rotate(-22 8.8 22)"
        fill={C.gold}
      />
      <path
        d="M8 20c3 0 3 5 .5 4.5M16 24l8-5m-7 1 8-5"
        fill="none"
        stroke={C.brass}
      />
      <path d="m10 13 9-6 7 4-8 6Z" fill={ancient ? C.leaf : '#b28654'} />
      {ancient && (
        <>
          <path d="M20 12c-3-6-6-3-7-7 6-1 9 2 7 7Z" fill={C.leaf} />
          <path d="M21 11c0-5 5-7 8-5-2 4-4 5-8 5Z" fill={C.pale} />
        </>
      )}
    </g>
  );
}
function Wheat() {
  return (
    <g {...outline}>
      <path d="m7 15 2 12 12 1 3-13-8-4Z" fill={C.wood} />
      <path d="m8 16 15 0-3 11-10-1Z" fill={C.brass} />
      <path
        d="M13 23 14 5m3 18 4-18M9 22 7 7"
        fill="none"
        stroke={C.light}
        strokeWidth="1.4"
      />
      <path
        d="M14 8c-5-1-5-4-3-5 3 0 4 2 3 5Zm0 4c4-1 5-4 3-5-3 0-4 2-3 5Zm-.5 5c-4-1-6-4-4-5 3 0 4 2 4 5ZM20 11c-4-1-4-4-2-5 3 0 3 2 2 5Zm0 3c4 0 6-3 4-5-3 0-4 2-4 5ZM8 13c-4 0-6-3-4-5 3 0 4 2 4 5Z"
        fill={C.light}
      />
      <path d="m7 19 16 1m-14 4 12 1" stroke={C.bark} />
    </g>
  );
}
function Rock({ ore = false }: { ore?: boolean }) {
  return (
    <g {...outline}>
      <path
        d="m3 23 4-11 8-4 10 5 4 12-9 4-13-2Z"
        fill={ore ? '#4c5c5d' : C.stone}
      />
      <path d="m7 12 8-4 4 9-10 1Z" fill={ore ? '#7b8d94' : C.steel} />
      <path d="m19 17 6-4 4 12-9 4Z" fill={ore ? '#354b4c' : '#5a7370'} />
      <path d="m9 18 10-1 1 12-13-2Z" fill={ore ? '#586d70' : '#93a5a0'} />
      {ore ? (
        <>
          <path d="m10 15 4-2 2 5-4 2Z" fill={C.brass} />
          <path d="m21 21 4-3 1 5-4 2Z" fill={C.gold} />
          <path d="m8 23 3-2 2 3-3 2Z" fill={C.steel} />
        </>
      ) : (
        <path d="m13 20 4 2-2 3m-9-5 3 1" fill="none" stroke={C.frost} />
      )}
    </g>
  );
}
function Coins() {
  return (
    <g {...outline}>
      <path d="M3 20v6c0 4 14 4 14 0v-6" fill={C.brass} />
      <ellipse cx="10" cy="20" rx="7" ry="3" fill={C.light} />
      <path
        d="M4 23c4 2 8 2 12 0m-12 3c4 2 8 2 12 0"
        fill="none"
        stroke={C.gold}
      />
      <path d="M14 12v11c0 4 15 4 15 0V12" fill={C.gold} />
      <ellipse cx="21.5" cy="12" rx="7.5" ry="3.5" fill={C.light} />
      <ellipse
        cx="21.5"
        cy="12"
        rx="3.8"
        ry="1.6"
        fill="none"
        stroke={C.brass}
      />
      <path
        d="M15 16c4 2 9 2 13 0m-13 4c4 2 9 2 13 0m-5-9-3 2"
        fill="none"
        stroke={C.brass}
      />
      <Spark x={8} y={9} />
    </g>
  );
}
function Ingot({ refined = false }: { refined?: boolean }) {
  return (
    <g {...outline}>
      <path d="m3 21 5-8 16-1 5 8-7 7H7Z" fill={refined ? C.steel : C.stone} />
      <path d="m8 13 16-1-3 8-18 1Z" fill={refined ? C.frost : '#acbab4'} />
      <path d="m3 21 18-1 1 7H7Z" fill={refined ? '#93aaa5' : '#687e78'} />
      <path d="m21 20 3-8 5 8-7 7Z" fill={refined ? C.blue : '#526765'} />
      <path d="m10 14 11-1" stroke={C.ivory} />
      {refined && (
        <>
          <path
            d="m10 21 3 3 3-3"
            fill="none"
            stroke={C.gold}
            strokeWidth="1.5"
          />
          <Spark x={24} y={7} />
        </>
      )}
    </g>
  );
}
function Crystal({ star = false }: { star?: boolean }) {
  return (
    <g {...outline}>
      <path d="m12 7 6-5 6 7-3 15-6 5-7-9Z" fill={star ? C.violet : C.green} />
      <path d="m18 2-2 16-8 2 4-13Z" fill={star ? '#baa9ce' : '#9ec5ab'} />
      <path d="m18 2 6 7-3 15-5-6Z" fill={star ? '#82799f' : '#588f7d'} />
      <path d="m16 18 5 6-6 5Z" fill={star ? C.night : '#305e52'} />
      <path d="m4 16 5-4 3 6-3 9-5-4Z" fill={star ? C.blue : C.leaf} />
      <path d="m22 21 4-6 4 5-4 8-4-1Z" fill={star ? C.gold : '#b1c9af'} />
      <Spark x={24} y={5} color={star ? C.ivory : C.pale} />
      {star && (
        <path
          d="m17 11 .6 2.6L20 15l-2.4 1.2L17 19l-.7-2.8L14 15l2.3-1.4Z"
          fill={C.light}
          stroke="none"
        />
      )}
    </g>
  );
}
function Fire({ camp = false }: { camp?: boolean }) {
  return (
    <g {...outline}>
      <path d="m6 26 18-4 2 4-19 4Z" fill={C.bark} />
      <path d="m8 21 18 6-2 3-18-6Z" fill={C.wood} />
      <path
        d="M8 22c-4-8 5-10 5-19 6 3 3 10 7 9 1-3 2-4 2-4 7 10 7 17-1 19-6 2-11-1-13-5Z"
        fill={C.ember}
      />
      <path d="M13 25c-5-6 2-9 3-15 4 3 2 7 5 8 3 4 0 9-4 9Z" fill={C.gold} />
      <path d="M15 26c-1-3 1-5 2-7 3 3 3 6 1 8Z" fill={C.light} stroke="none" />
      {!camp && (
        <>
          <path
            d="m3 13 2-3 2 3-2 2Zm22-9 2-2 1 3-2 1Z"
            fill={C.gold}
            stroke="none"
          />
          <path d="M8 8 6 5m19 15 3-3" stroke={C.ember} />
        </>
      )}
    </g>
  );
}
function Sand() {
  return (
    <g {...outline}>
      <path
        d="m10 5 11 0-2 5c5 4 8 8 7 12-1 7-20 8-21 0-1-5 4-9 7-12Z"
        fill={C.violet}
      />
      <path d="m12 10 7 0M10 5l4 3 6-3" fill="none" stroke={C.ivory} />
      <path
        d="M7 20c5-3 12-2 17 0v3c-2 5-16 5-17 0Z"
        fill={C.blue}
        stroke="none"
      />
      <path d="m11 18 4-3 4 1 2 3" fill={C.ivory} stroke="none" />
      <circle cx="12" cy="22" r="1" fill={C.light} stroke="none" />
      <circle cx="19" cy="21" r="1.1" fill={C.frost} stroke="none" />
      <Spark x={25} y={9} color={C.ivory} />
    </g>
  );
}
function Scale() {
  return (
    <g {...outline}>
      <path d="m16 3 11 10-2 10-9 7-9-7-2-10Z" fill={C.red} />
      <path d="m16 3 0 24-9-5-1-9Z" fill={C.ember} />
      <path d="m16 7 7 7-2 6-5 5-5-5-2-6Z" fill={C.gold} />
      <path d="m16 7 0 18 5-5 2-6Z" fill={C.brass} />
      <path d="m16 11 3 4-3 5-3-5Z" fill={C.ember} />
      <path d="m9 12 4-5m-3 15 5 5" stroke={C.light} />
    </g>
  );
}
function Boards() {
  return (
    <g {...outline}>
      <path d="m3 21 17-11 10 5-17 12Z" fill={C.wood} />
      <path d="m3 21 0 4 10 5v-3Z" fill={C.bark} />
      <path d="m13 27 17-12v4L13 30Z" fill={C.brass} />
      <path d="m2 15 18-11 10 5-18 12Z" fill={C.gold} />
      <path d="m2 15 0 4 10 5v-3Z" fill={C.wood} />
      <path d="m12 21 18-12v4L12 25Z" fill={C.brass} />
      <path d="m8 15 14-8M7 18 23 8m-9 16 10-7" fill="none" stroke={C.bark} />
      <path d="m6 15 13-8" stroke={C.light} />
    </g>
  );
}
function Rune() {
  return (
    <g {...outline}>
      <path d="m9 3 14 1 5 7-4 18-17-1-3-17Z" fill={C.stone} />
      <path d="m10 5 11 1 4 6-3 14-13-1-2-13Z" fill={C.green} />
      <path
        d="M16 8v14m-5-11 5 4 5-4m-9 10 4-4 4 4"
        fill="none"
        stroke={C.light}
        strokeWidth="1.7"
      />
      <path d="m8 26 4 2m12-17 1 5" stroke={C.steel} />
    </g>
  );
}
function Tree({
  x = 6,
  y = 4,
  small = false,
}: {
  x?: number;
  y?: number;
  small?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${small ? 0.7 : 1})`}
      {...outline}
    >
      <path d="M4 11h3v13H4Z" fill={C.wood} />
      <path d="m5 0 6 9H8l5 7H-2l5-7H0Z" fill={C.green} />
      <path d="m5 1-2 9H1l4-1-1 7h6l-3-6h3Z" fill={C.leaf} stroke="none" />
    </g>
  );
}
function House({
  warehouse = false,
  tavern = false,
}: {
  warehouse?: boolean;
  tavern?: boolean;
}) {
  return (
    <g {...outline}>
      <path d="M5 13h22v15H5Z" fill={warehouse ? C.wood : C.ivory} />
      <path d="M5 13h5v15H5Z" fill={C.brass} />
      <path d="m2 14 9-10h12l7 10Z" fill={tavern ? C.green : C.wood} />
      <path d="m2 14 9-10 5 10Z" fill={tavern ? C.leaf : C.gold} />
      <path
        d="m13 7 10 0m-8 3h10"
        fill="none"
        stroke={tavern ? C.pale : C.bark}
      />
      <path
        d={warehouse ? 'M13 16h11v12H13Z' : 'M14 19c0-5 7-5 7 0v9h-7Z'}
        fill={C.bark}
      />
      {warehouse ? (
        <>
          <path d="M18.5 16v12m-5-11 10 10m-10 0 10-10" stroke={C.gold} />
          <path d="M4 22h6v6H4Z" fill={C.brass} />
        </>
      ) : (
        <>
          <path d="M7 17h4v5H7Z" fill={C.blue} />
          <path d="M9 17v5m-2-2.5h4" stroke={C.bark} />
          <circle cx="19" cy="22" r=".7" fill={C.gold} stroke="none" />
        </>
      )}
      {tavern && (
        <>
          <path d="M25 3v7" stroke={C.bark} strokeWidth="2" />
          <path d="M22 3h7v6h-7Z" fill={C.gold} />
          <path d="M24 4h3v4h-3Zm3 1h1v2h-1" fill={C.ivory} strokeWidth=".6" />
        </>
      )}
    </g>
  );
}
function Farm() {
  return (
    <g {...outline}>
      <path d="m2 22 13-8 15 8-12 8Z" fill={C.bark} />
      <path
        d="m6 23 13-7m-8 10 13-7m-9 9 12-7"
        stroke={C.wood}
        strokeWidth="2"
      />
      <path d="M10 20V8m7 14V6m7 13V9" stroke={C.gold} strokeWidth="1.2" />
      <path
        d="M10 13c-5 0-5-4-3-5 3 0 3 3 3 5Zm0 3c4-1 5-4 3-5-2 0-3 2-3 5ZM17 10c-5 0-5-4-3-5 3 0 3 3 3 5Zm0 5c4-1 6-4 3-5-2 0-3 2-3 5ZM24 14c-4 0-5-4-2-5 2 0 3 3 2 5Z"
        fill={C.light}
      />
      <path d="M5 20c-3-5-1-7 1-7l1 5m13 6c3-5 6-4 7-3" fill={C.green} />
    </g>
  );
}
function Quarry() {
  return (
    <g {...outline}>
      <path d="m2 25 3-16 9-5 12 5 4 16Z" fill={C.stone} />
      <path d="m5 9 9-5 2 10-9 3Z" fill={C.steel} />
      <path d="m16 14 10-5 4 16H16Z" fill="#526965" />
      <path d="M7 17h9v5H5m12-8 7 0m-17-4 4-1" fill="none" stroke={C.ink} />
      <path d="m11 29 10-15" stroke={C.wood} strokeWidth="2.8" />
      <path d="M14 15c4-5 10-6 15-2l-8-1-4 5Z" fill={C.steel} />
      <path d="m1 26 5-4 5 3-2 4H2Z" fill={C.steel} />
    </g>
  );
}
function Market() {
  return (
    <g {...outline}>
      <path d="M5 12h2v17H5Zm20 0h2v17h-2Z" fill={C.wood} />
      <path d="M3 20h26v8H3Z" fill={C.wood} />
      <path d="M6 21h20v5H6Z" fill={C.brass} />
      <path d="m3 5 24 0 3 10H1Z" fill={C.ivory} />
      <path d="m5 5 5 0-1 10H3Zm11 0h5l2 10h-6Z" fill={C.green} />
      <path
        d="M1 15h29v3c-2 2-4 2-6 0-2 2-5 2-7 0-3 2-5 2-7 0-3 2-6 2-9 0Z"
        fill={C.gold}
      />
      <circle cx="11" cy="21" r="2.7" fill={C.red} />
      <circle cx="16" cy="21" r="2.7" fill={C.leaf} />
      <path d="M22 20h4v4h-4Z" fill={C.ivory} />
      <path d="M7 27v2m16-2v2" stroke={C.bark} strokeWidth="2" />
    </g>
  );
}
function Forge() {
  return (
    <g {...outline}>
      <path d="M3 27V11l6-6h9l4 7v15Z" fill={C.stone} />
      <path d="M8 10V3h5v7Z" fill={C.steel} />
      <path d="M6 27v-9c0-9 13-9 13 0v9Z" fill={C.ink} />
      <path d="M9 23c-3-6 3-6 3-12 5 4 2 6 5 8 2 4-2 7-5 7Z" fill={C.ember} />
      <path d="M11 24c-2-3 2-5 2-7 3 3 4 8 0 9Z" fill={C.gold} />
      <path d="M16 20h14l-4 4h-3v3h4v2H15v-2h4v-3Z" fill={C.steel} />
      <path d="M20 22h7" stroke={C.frost} />
    </g>
  );
}
function Book({ magic = false }: { magic?: boolean }) {
  return (
    <g {...outline}>
      <path
        d="M3 7c5-2 9-1 13 2 5-3 9-4 13-2v19c-5-1-9 0-13 3-4-3-9-4-13-3Z"
        fill={C.green}
      />
      <path
        d="M5 5c4-1 8 0 11 3v18c-3-3-7-4-11-3Zm11 3c4-3 7-4 11-3v18c-4-1-8 0-11 3Z"
        fill={C.ivory}
      />
      <path
        d="M16 8v18M8 10l5 2m-5 3 5 2m-5 3 5 2m6-10 5-2m-5 7 5-2m-5 7 5-2"
        fill="none"
        stroke={C.brass}
        strokeWidth=".8"
      />
      {magic && (
        <>
          <circle cx="16" cy="12" r="5" fill={C.green} />
          <path
            d="m16 8 .7 2.7L20 12l-3.3 1.3L16 16l-.8-2.7L12 12l3.2-1.3Z"
            fill={C.light}
            stroke="none"
          />
          <Spark x={24} y={3} />
        </>
      )}
    </g>
  );
}
function Shrine() {
  return (
    <g {...outline}>
      <path d="M5 13h22v14H5Z" fill={C.steel} />
      <path d="M3 28h26v2H3Z" fill={C.stone} />
      <path d="m2 13 14-11 14 11Z" fill={C.green} />
      <path d="m6 12 10-8 10 8Z" fill={C.leaf} />
      <path d="M8 15h3v12H8Zm13 0h3v12h-3Z" fill={C.ivory} />
      <path d="M14 19c0-4 5-4 5 0v8h-5Z" fill={C.night} />
      <circle cx="16" cy="9" r="2.2" fill={C.gold} />
      <path d="m14 21 3-1 2 1v3l-2-1-3 1Z" fill={C.ivory} />
    </g>
  );
}
function Blade() {
  return (
    <g {...outline}>
      <path d="m10 22 14-19 5-1-1 6-15 17Z" fill={C.steel} />
      <path d="M10 22 29 2 24 3 8 21Z" fill={C.frost} />
      <path d="m6 19 10 7 2-3-11-7Z" fill={C.gold} />
      <path d="m8 22 4 3-5 6-4-3Z" fill={C.wood} />
      <path d="m3 27 5 4 2-3-5-4Z" fill={C.brass} />
      <path d="m12 21 11-12" stroke={C.ivory} />
    </g>
  );
}
function Bow() {
  return (
    <g {...outline}>
      <path d="M9 2c17 3 22 12 18 23-3-10-8-16-18-23Z" fill={C.gold} />
      <path d="m9 2 17 24" fill="none" stroke={C.ivory} />
      <path d="M24 3 5 27" stroke={C.wood} strokeWidth="1.7" />
      <path d="m24 2-1 8 6-5Z" fill={C.steel} />
      <path d="m6 21-4 2 0 6 6-3Z" fill={C.leaf} />
      <path d="m16 9 5 6" stroke={C.bark} strokeWidth="2" />
    </g>
  );
}
function Pike() {
  return (
    <g {...outline}>
      <path d="m5 30 18-23" stroke={C.wood} strokeWidth="3" />
      <path d="m22 3 8-2-3 10-7 3 1-6Z" fill={C.steel} />
      <path d="m22 3 8-2-8 10-2 3 1-6Z" fill={C.frost} />
      <path d="m17 13 5 4-1 2-6-4Z" fill={C.brass} />
      <path d="m18 17-6 2 3-6Z" fill={C.red} />
      <path d="m8 25 2 2m1-6 2 2" stroke={C.ivory} />
    </g>
  );
}
function Staff() {
  return (
    <g {...outline}>
      <path d="m8 29 10-20" stroke={C.bark} strokeWidth="3.4" />
      <path d="m9 28 10-20" stroke={C.gold} strokeWidth="1" />
      <path
        d="M16 14c-5-3-4-9 0-12 0 4 2 6 5 8 3-1 5-3 5-6 3 5-2 12-10 10Z"
        fill={C.gold}
      />
      <path d="m19 1 4 4-3 7-4-6Z" fill={C.green} />
      <path d="m19 1 1 11-4-6Z" fill={C.pale} />
      <path d="m12 21 4 2m-6 1 4 2" stroke={C.ivory} />
      <Spark x={28} y={15} />
    </g>
  );
}
function Plate() {
  return (
    <g {...outline}>
      <path
        d="m9 3 5 3h4l5-3 7 8-5 5-2-3 1 15-8 2-8-2 1-15-2 3-5-5Z"
        fill={C.stone}
      />
      <path d="m10 7 6 3 6-3 0 13-6 6-6-6Z" fill={C.steel} />
      <path d="m16 10 0 16 6-6V7Z" fill={C.blue} />
      <path
        d="M9 4c2 5 12 5 14 0m-13 16 12 0M7 9l-3 4m21-4 3 4"
        fill="none"
        stroke={C.ivory}
      />
      <path d="m13 13 3-2 3 2-3 6Z" fill={C.gold} />
      <path d="M9 26h14" stroke={C.bark} strokeWidth="2" />
    </g>
  );
}
function Robe({ tone }: { tone: 'fire' | 'shadow' | 'dawn' }) {
  const fill = tone === 'fire' ? C.red : tone === 'shadow' ? C.night : C.ivory;
  const trim =
    tone === 'fire' ? C.ember : tone === 'shadow' ? C.violet : C.gold;
  return (
    <g {...outline}>
      <path
        d="m12 3 8 0 2 6 7 4-3 8-4-2 4 10-10-1-10 1 4-10-4 2-3-8 7-4Z"
        fill={fill}
      />
      <path d="m12 3 4 6 4-6 2 6-6 7-6-7Z" fill={trim} />
      <path d="m16 16-5 12 5-1 5 1Z" fill={trim} />
      <path d="M9 17h14m-17-1 3 1m15 0 3-1" stroke={C.gold} strokeWidth="1.4" />
      {tone === 'fire' ? (
        <path
          d="M14 21c-2-3 1-4 2-7 2 3 4 4 2 7-1 2-3 1-4 0Z"
          fill={C.light}
          stroke="none"
        />
      ) : tone === 'shadow' ? (
        <path
          d="M18 16a4 4 0 1 0 0 8c-3-2-3-6 0-8Z"
          fill={C.ivory}
          stroke="none"
        />
      ) : (
        <>
          <circle cx="16" cy="20" r="2.4" fill={C.gold} />
          <path d="M16 15v2m0 6v2m-5-5h2m6 0h2" stroke={C.brass} />
        </>
      )}
    </g>
  );
}
function Amulet({ ward = false }: { ward?: boolean }) {
  return (
    <g {...outline}>
      <path
        d="M9 4c-7 9 1 17 7 20 7-4 14-12 7-20"
        fill="none"
        stroke={C.brass}
        strokeWidth="2"
      />
      <path d="M9 4c2-2 12-2 14 0" fill="none" stroke={C.gold} />
      <path d="m16 15 9 7-9 8-9-8Z" fill={C.gold} />
      {ward ? (
        <>
          <path d="m16 17 0 10-6-5Z" fill={C.green} />
          <path d="m16 17 6 5-6 5Z" fill={C.blue} />
          <path d="m16 20 2 3-2 3-2-3Z" fill={C.violet} />
        </>
      ) : (
        <>
          <path d="M16 20c4-5 8 1 0 7-8-6-4-12 0-7Z" fill={C.green} />
          <path d="M13 21c0-1 2-1 2 0" fill="none" stroke={C.pale} />
        </>
      )}
      <path d="m8 11 2 3m12-5-1 3" stroke={C.light} />
    </g>
  );
}
function Cap() {
  return (
    <g {...outline}>
      <path d="M7 20V11C7 1 24 1 25 12l-1 8Z" fill={C.wood} />
      <path d="M7 20V11c0-6 5-8 9-8l-3 17Z" fill={C.gold} />
      <path d="M4 19c9 3 17 2 24-2l1 6c-8 5-17 7-27 2Z" fill={C.bark} />
      <path d="M5 21c8 2 15 1 22-1" fill="none" stroke={C.brass} />
      <path d="M22 17c-1-8 2-13 8-14-1 7-3 10-8 14Z" fill={C.leaf} />
      <path d="m22 18 5-10" stroke={C.ivory} />
      <path d="M8 23h6v5H8Z" fill={C.gold} />
      <path d="M10 24h2v3h-2Z" fill={C.wood} />
    </g>
  );
}
function Grips() {
  return (
    <g {...outline}>
      <path d="m8 4 13 1 0 5-2 6 4 8-5 6-10-5 2-9-3-4Z" fill={C.wood} />
      <path d="m9 7 11 1-1 8-8-1Z" fill={C.green} />
      <path d="m10 6 9 1-1 7-7-1Z" fill={C.leaf} />
      <path d="m9 17 10 1-1 4-9-2Z" fill={C.gold} />
      <path d="m12 22 0 4m3-3v5m3-5 1 4" stroke={C.bark} />
      <path d="m7 15-4 4 2 6 5 1" fill={C.wood} />
      <path d="m10 5 2 8m5-7-2 8" stroke={C.ivory} />
    </g>
  );
}
function Boots() {
  return (
    <g {...outline}>
      <path d="m7 3 11 1-2 14 4 4-1 5-16-1v-5l5-3Z" fill={C.bark} />
      <path d="m8 4 7 1-1 10-5 1Z" fill={C.green} />
      <path d="m16 8 12 1-3 13 5 3-1 5-17-1v-6l5-3Z" fill={C.wood} />
      <path d="m18 9 7 1-2 9-6 1Z" fill={C.leaf} />
      <path d="m16 18 8 1-1 4-8-1Z" fill={C.gold} />
      <path d="m18 20 3 .3" stroke={C.bark} />
      <path d="M13 27h16M4 24h8" stroke={C.ivory} strokeWidth="1.5" />
      <path d="m18 10 4 2-5 2 4 2" fill="none" stroke={C.ivory} />
    </g>
  );
}
function Scroll() {
  return (
    <g {...outline}>
      <path d="M8 5h17v19c0 4-4 5-7 4H7V8Z" fill={C.ivory} />
      <path
        d="M8 5c-6-1-7 6-2 7h4V8c0-2-1-3-2-3Zm10 23c-5 0-4-6 0-6h10v3c0 3-5 4-10 3Z"
        fill={C.gold}
      />
      <path d="M13 10h8m-8 4h8m-8 4h5" stroke={C.brass} />
      <circle cx="22" cy="21" r="4" fill={C.red} />
      <path
        d="m22 18 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"
        fill={C.gold}
        stroke="none"
      />
    </g>
  );
}
function Illustration({ kind, id }: Pick<Props, 'kind' | 'id'>): ReactNode {
  if (kind === 'resource') {
    switch (id) {
      case 'wood':
        return <Log />;
      case 'food':
        return <Wheat />;
      case 'stone':
        return <Rock />;
      case 'gold':
        return <Coins />;
      case 'iron':
        return <Ingot />;
      case 'crystal':
        return <Crystal />;
    }
  }
  if (kind === 'material') {
    switch (id) {
      case 'timber':
        return <Log ancient />;
      case 'essence':
        return <Sand />;
      case 'ore':
        return <Rock ore />;
      case 'ember':
        return <Fire />;
      case 'scale':
        return <Scale />;
      case 'star':
        return <Crystal star />;
      case 'boards':
        return <Boards />;
      case 'steel':
        return <Ingot refined />;
      case 'runes':
        return <Rune />;
    }
  }
  if (kind === 'building') {
    switch (id) {
      case 'fire':
        return <Fire camp />;
      case 'hut':
        return <House />;
      case 'warehouse':
        return <House warehouse />;
      case 'lumber':
        return (
          <>
            <Tree x={5} y={1} />
            <g transform="translate(11 12) scale(.59)">
              <House />
            </g>
            <path d="m2 28 9-6 4 3-9 6Z" fill={C.wood} {...outline} />
          </>
        );
      case 'farm':
        return <Farm />;
      case 'quarry':
        return <Quarry />;
      case 'market':
        return <Market />;
      case 'tavern':
        return <House tavern />;
      case 'forge':
        return <Forge />;
      case 'shrine':
        return <Shrine />;
    }
  }
  if (kind === 'equipment') {
    switch (id) {
      case 'weapon':
      case 'blade':
        return <Blade />;
      case 'bow':
        return <Bow />;
      case 'pike':
        return <Pike />;
      case 'staff':
        return <Staff />;
      case 'armor':
      case 'plate':
        return <Plate />;
      case 'firecoat':
        return <Robe tone="fire" />;
      case 'shadowcoat':
        return <Robe tone="shadow" />;
      case 'dawncoat':
        return <Robe tone="dawn" />;
      case 'charm':
      case 'vitality':
        return <Amulet />;
      case 'wardstone':
        return <Amulet ward />;
      case 'head':
      case 'cap':
        return <Cap />;
      case 'hands':
      case 'grips':
        return <Grips />;
      case 'feet':
      case 'boots':
        return <Boots />;
    }
  }
  if (kind === 'research') {
    if (/forestry|carpentry|settlement|wood|tool/.test(id))
      return (
        <>
          <g transform="translate(-1 1) scale(.85)">
            <Boards />
          </g>
          <g transform="translate(13 1) scale(.55)">
            <Scroll />
          </g>
        </>
      );
    if (/agriculture|food/.test(id)) return <Wheat />;
    if (/masonry|stone/.test(id)) return <Quarry />;
    if (/commerce|logistics|storage/.test(id)) return <Scroll />;
    if (/smelt|metal|smith|forge/.test(id))
      return (
        <>
          <Ingot refined />
          <g transform="translate(12 -2) scale(.55)">
            <Scroll />
          </g>
        </>
      );
    if (/rune|magic|attune|inscription|mythic|scholar/.test(id))
      return <Book magic />;
    if (/dragon/.test(id)) return <Scale />;
    if (/infernal|fire/.test(id)) return <Fire />;
    return <Book />;
  }
  if (kind === 'skill') {
    if (/heal|mend|life|bless|renew|purif|cleanse|prayer|mercy/.test(id))
      return <Amulet />;
    if (/guard|shield|protect|fort|vow|defen/.test(id)) return <Plate />;
    if (/fire|flame|burn|ignite|infernal/.test(id)) return <Fire />;
    if (/frost|ice|star|arcane|mana|spell/.test(id)) return <Crystal star />;
    if (/shot|arrow|hunt|aim|ranger/.test(id)) return <Bow />;
    if (/dodge|dash|swift|evade/.test(id)) return <Boots />;
    if (/shadow|dark|curse|seal/.test(id)) return <Rune />;
    return <Blade />;
  }
  return <Scroll />;
}

export function ItemArt({ kind, id, size = 24, className = '' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      style={{
        display: 'inline-block',
        flexShrink: 0,
        verticalAlign: 'middle',
        width: size,
        height: size,
      }}
    >
      <Shadow />
      <Illustration kind={kind} id={id} />
    </svg>
  );
}
