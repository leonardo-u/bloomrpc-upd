import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTabNodeProps {
  id: string;
  active: boolean;
  children: React.ReactNode;
}

export const SortableTabNode: React.FC<SortableTabNodeProps> = ({ id, active, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'move',
    opacity: isDragging ? 0.6 : 1,
    display: 'inline-block',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-item ${active ? 'active' : ''}`}
    >
      {children}
    </div>
  );
};
