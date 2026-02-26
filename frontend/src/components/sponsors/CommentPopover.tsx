'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

interface CommentPopoverProps {
  value?: string | null;
  onSave: (value: string) => void;
  disabled?: boolean;
}

export function CommentPopover({ value, onSave, disabled }: CommentPopoverProps) {
  const [draft, setDraft] = useState(value ?? '');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} className="h-8 w-8">
          <MessageSquare className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <Textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} />
          <Button size="sm" onClick={() => onSave(draft)}>
            Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
