import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  contactsService,
  type ContactFilters,
  type CreateContactInput,
  type UpdateContactInput,
  type ContactDetails,
} from '@/services/contacts';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      response?: { data?: { error?: string } };
      message?: string;
    };

    return maybeError.response?.data?.error ?? maybeError.message ?? fallback;
  }

  return fallback;
};

export function useContacts(filters?: ContactFilters) {
  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => contactsService.list(filters),
  });
}

export function useContact(id?: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () => (id ? contactsService.get(id) : Promise.reject('missing id')),
    enabled: Boolean(id),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateContactInput) => contactsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato criado com sucesso!');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao criar contato.');
      toast.error(message);
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContactInput }) =>
      contactsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato atualizado com sucesso!');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao atualizar contato.');
      toast.error(message);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contactsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato removido.');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao remover contato.');
      toast.error(message);
    },
  });
}

export function useContactTagsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      tags,
      action,
    }: {
      id: string;
      tags: string[];
      action: 'add' | 'remove';
    }): Promise<ContactDetails> =>
      action === 'add'
        ? contactsService.addTags(id, tags)
        : contactsService.removeTags(id, tags),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts', variables.id] });
      toast.success('Tags atualizadas.');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao atualizar tags.');
      toast.error(message);
    },
  });
}
