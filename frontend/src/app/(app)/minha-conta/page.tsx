'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { useAuth } from '@/components/providers/auth-provider';
import { backend } from '@/services/backend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const profileSchema = z.object({
  name: z.string().min(1, 'Informe o nome').optional(),
  username: z
    .string()
    .min(3, 'Minimo 3 caracteres')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Use letras, numeros e ._-')
    .optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Minimo 6 caracteres'),
    newPassword: z.string().min(6, 'Minimo 6 caracteres'),
    confirmPassword: z.string().min(6, 'Minimo 6 caracteres'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas nao conferem',
    path: ['confirmPassword'],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function MinhaContaPage() {
  const { apiFetch } = useApiClient();
  const { user, refresh } = useAuth();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', username: user?.username || '' },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({ name: user.name || '', username: user.username || '' });
  }, [user, profileForm]);

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) => backend.updateMe(apiFetch, values),
    onSuccess: async () => {
      await refresh();
      toast.success('Perfil atualizado');
    },
    onError: () => toast.error('Falha ao atualizar perfil'),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      backend.changeMyPassword(apiFetch, { currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: async () => {
      await refresh();
      passwordForm.reset();
      toast.success('Senha atualizada');
    },
    onError: () => toast.error('Falha ao atualizar senha'),
  });

  const mustChange = Boolean(user?.mustChangePassword);
  const banner = useMemo(() => {
    if (!mustChange) return null;
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Para continuar, atualize sua senha.
      </div>
    );
  }, [mustChange]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Minha conta</h1>
        <p className="text-sm text-muted-foreground">Atualize seu nome, login e senha.</p>
      </div>

      {banner}

      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Dados do usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login</FormLabel>
                    <FormControl>
                      <Input placeholder="seu.login" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha atual</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? 'Salvando...' : 'Salvar senha'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
