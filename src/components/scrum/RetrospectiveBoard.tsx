import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

export function RetrospectiveBoard() {
  const [wentWell, setWentWell] = useState('');
  const [toImprove, setToImprove] = useState('');
  const [actions, setActions] = useState('');
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader><CardTitle>Foi bem</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={8} value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Para melhorar</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={8} value={toImprove} onChange={(e) => setToImprove(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={8} value={actions} onChange={(e) => setActions(e.target.value)} />
        </CardContent>
      </Card>
    </div>
  );
}

