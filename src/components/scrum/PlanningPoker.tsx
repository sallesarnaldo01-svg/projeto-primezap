import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

type Props = {
  onEstimate?: (value: number) => void;
};

const FIB = [0, 1, 2, 3, 5, 8, 13, 21, 34];

export function PlanningPoker({ onEstimate }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning Poker</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {FIB.map((v) => (
          <Button
            key={v}
            variant={selected === v ? 'default' : 'outline'}
            onClick={() => {
              setSelected(v);
              onEstimate?.(v);
            }}
          >
            {v}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

