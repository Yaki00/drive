import { useDroppable } from '@dnd-kit/core';
import { Box } from '@mui/material';
import type { ReactNode } from 'react';

interface CardDropZoneProps {
  cardId: number;
  children: ReactNode;
}

export function CardDropZone({ cardId, children }: CardDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `card-drop-${cardId}`,
    data: { type: 'card-drop', cardId },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        height: 'auto',
        alignSelf: 'start',
        width: '100%',
        borderRadius: 1,
        outline: isOver ? '2px dashed' : 'none',
        outlineColor: 'primary.main',
        outlineOffset: 2,
        transition: 'outline 0.15s',
      }}
    >
      {children}
    </Box>
  );
}
