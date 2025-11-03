import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Lightbulb, RefreshCcw, Sparkles } from 'lucide-react';

export interface PromptSnippet {
  id: string;
  label: string;
  description?: string;
  content: string;
  category?: string;
}

export interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  helperText?: string;
  snippets?: PromptSnippet[];
  disabled?: boolean;
  className?: string;
}

const FALLBACK_SNIPPETS: PromptSnippet[] = [
  {
    id: 'tone',
    label: 'Tom & Linguagem',
    content:
      'Adote um tom profissional e cordial. Utilize frases curtas e objetivas. Ofereça sempre próximos passos e opções claras.',
    category: 'Boas práticas',
  },
  {
    id: 'automation',
    label: 'Automação',
    content:
      'Identifique oportunidades de automação de mensagens, follow-ups e workflows. Sugira integrações com WhatsApp, Instagram e e-mail.',
    category: 'Automação',
  },
  {
    id: 'escalation',
    label: 'Escalonamento',
    content:
      'Quando detectar clientes com sentimento negativo, escale para o time humano e registre a ocorrência no CRM.',
    category: 'Suporte',
  },
];

export const SystemPromptEditor = ({
  value,
  onChange,
  maxLength = 4000,
  helperText,
  snippets,
  disabled,
  className,
}: SystemPromptEditorProps) => {
  const characters = value.length;
  const isOverLimit = characters > maxLength;

  const categories = useMemo(() => {
    const source = snippets?.length ? snippets : FALLBACK_SNIPPETS;
    const grouped = source.reduce<Record<string, PromptSnippet[]>>((acc, item) => {
      const key = item.category ?? 'Sugestões';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    return grouped;
  }, [snippets]);

  const handleAppend = (snippet: PromptSnippet) => {
    if (snippet.content.includes(value.trim())) return;
    const next = value.trim().length > 0 ? `${value.trim()}\n\n${snippet.content}` : snippet.content;
    onChange(next);
  };

  const suggestionList = Object.entries(categories);

  return (
    <div className={cn('grid gap-5', className)}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Prompt do Sistema</CardTitle>
            <CardDescription>
              Defina as instruções principais que serão enviadas ao modelo antes de toda
              interação.
            </CardDescription>
          </div>
          <Badge
            variant={isOverLimit ? 'destructive' : characters > maxLength * 0.8 ? 'secondary' : 'outline'}
            className="whitespace-nowrap"
          >
            {characters}/{maxLength} caracteres
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            minRows={10}
            maxRows={20}
            disabled={disabled}
            className={cn(
              'font-mono text-sm',
              isOverLimit && 'border-destructive focus-visible:ring-destructive',
            )}
            placeholder="Descreva o papel do agente, tom de voz, restrições, gatilhos e ações esperadas..."
          />

          <div className="flex items-start gap-3 rounded-lg border border-dashed border-muted p-3 text-sm text-muted-foreground">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p>
                Combine normas de atendimento, políticas de privacidade, fluxo de
                automações e instruções de fallback para o time humano.
              </p>
              {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
              {isOverLimit && (
                <p className="text-xs font-medium text-destructive">
                  O prompt ultrapassou o limite recomendado. Considere dividir em módulos.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Snippets e Boas Práticas</CardTitle>
            <CardDescription>
              Aproveite sugestões prontas para acelerar a configuração do agente.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange('')}
            disabled={disabled || value.length === 0}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Limpar prompt
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {suggestionList.map(([category, entries]) => (
            <div key={category} className="space-y-2 rounded-md border border-muted p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                {category}
              </div>
              <div className="space-y-2">
                {entries.map((snippet) => (
                  <button
                    key={snippet.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleAppend(snippet)}
                    className={cn(
                      'w-full rounded-md border border-dashed border-muted px-3 py-2 text-left text-sm transition',
                      'hover:border-primary hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none',
                    )}
                  >
                    <div className="font-medium">{snippet.label}</div>
                    {snippet.description && (
                      <div className="text-xs text-muted-foreground">{snippet.description}</div>
                    )}
                    <div className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                      {snippet.content}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
