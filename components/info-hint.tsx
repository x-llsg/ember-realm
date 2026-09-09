'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Inline glossary terms must wrap with their sentence; keyboard and click behavior is provided below. */
import { useState, type ReactNode } from 'react';
import { HELP, type HelpKey } from '@/lib/glossary';
import * as G from '@/lib/realm';
import { GameIcon } from './game-art';
import '@/app/economy-art.css';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

export type Explanation = { title: string; body: ReactNode };
/** The explanation stays attached to its term: hover, keyboard focus, or tap. */
export function InfoHint({
  title,
  body,
  children,
  className = '',
  side = 'top',
  withinControl = false,
}: Explanation & {
  children: ReactNode;
  className?: string;
  withinControl?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delay={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          render={<span />}
          role={withinControl ? undefined : 'button'}
          tabIndex={withinControl ? -1 : 0}
          aria-label={withinControl ? undefined : title}
          className={'realm-hint-trigger ' + className}
          closeOnClick={false}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent role="tooltip" className="realm-hint-popup" side={side}>
          <strong>{title}</strong>
          <div className="realm-hint-body">
            {typeof body === 'string'
              ? body
                  .split('\n')
                  .filter(Boolean)
                  .map((line, i) => <p key={i}>{line}</p>)
              : body}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
export function Term({
  name,
  children,
}: {
  name: HelpKey;
  children: ReactNode;
}) {
  return <InfoHint {...HELP[name]}>{children}</InfoHint>;
}
export function ResourceName({ s, id }: { s: G.State; id: G.Resource }) {
  return (
    <InfoHint
      className="illustrated-term"
      title={G.RESOURCE_NAMES[id]}
      body={`库存 ${Math.floor(s.resources[id])} / ${G.capacity(s, id)}。\n${G.productionFormula(s, id)}`}
    >
      <GameIcon kind="resource" id={id} size={16} />
      <span>{G.RESOURCE_NAMES[id]}</span>
    </InfoHint>
  );
}
export function MaterialName({ s, id }: { s: G.State; id: G.MaterialId }) {
  return (
    <InfoHint
      className="illustrated-term"
      title={G.MATERIAL_NAMES[id]}
      body={`库存 ${Math.floor(s.world.materials[id])} / ${G.materialCapacity(s, id)}。\n来源：${G.MATERIAL_SOURCES[id]}`}
    >
      <GameIcon kind="material" id={id} size={16} />
      <span>{G.MATERIAL_NAMES[id]}</span>
    </InfoHint>
  );
}
