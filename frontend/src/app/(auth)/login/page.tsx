'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/errors';

const schema = z.object({
  identifier: z.string().min(3, 'Informe seu usuario'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

const demoAccess = {
  identifier: 'admin',
  password: '123456',
};

export default function LoginPage() {
  const { login } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.identifier, values.password);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Falha ao entrar'));
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#050b18] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -18, 12, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-44 left-1/2 h-[540px] w-[540px] -translate-x-1/2 rounded-full bg-blue-500/25 blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -35, 14, 0], y: [0, 14, -12, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 bottom-0 h-[360px] w-[360px] rounded-full bg-sky-500/15 blur-[130px]"
        />
        <motion.div
          animate={{ x: [0, 24, -16, 0], y: [0, -22, 16, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -right-16 top-1/3 h-[320px] w-[320px] rounded-full bg-indigo-500/25 blur-[120px]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.14),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(125,211,252,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.12),_transparent_45%)]" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
          className="absolute left-1/2 top-1/2 h-[820px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/20 border-dashed"
        >
          <div className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300 shadow-[0_0_20px_rgba(125,211,252,0.9)]" />
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
          className="absolute left-1/2 top-1/2 h-[980px] w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-300/20 border-dashed"
        >
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-300 shadow-[0_0_18px_rgba(165,180,252,0.85)]" />
        </motion.div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 56, repeat: Infinity, ease: 'linear' }}
          className="absolute left-1/2 top-1/2 h-[1120px] w-[1120px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-200/10 border-dashed"
        >
          <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200 shadow-[0_0_14px_rgba(191,219,254,0.8)]" />
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden flex-1 pr-10 lg:block"
        >
          <span className="inline-flex items-center rounded-full border border-sky-300/35 bg-sky-500/12 px-4 py-1 text-xs font-medium tracking-[0.12em] text-sky-100">
            PLANEJAMENTO PRINTBAG
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-white xl:text-5xl">
            Controle orcamentario
            <br />
            em tempo real
          </h1>
          <p className="mt-4 max-w-[520px] text-base leading-relaxed text-slate-300/90">
            Acesse o painel de indicadores, acompanhe DRE, BSC e a execucao mensal com uma visao unica.
          </p>
          <div className="mt-8 flex max-w-xl items-center gap-3 text-sm text-slate-200/90">
            <div className="h-10 w-1 rounded-full bg-gradient-to-b from-sky-300/80 via-blue-400/70 to-indigo-500/70" />
            <p className="rounded-xl border border-slate-300/15 bg-slate-900/35 px-4 py-3 backdrop-blur">
              Visao executiva com foco em governanca financeira, rastreabilidade de dados e tomada de decisao.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative w-full max-w-xl lg:max-w-md"
        >
          <motion.div
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/30 border-dashed"
          >
            <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.85)]" />
          </motion.div>
          <motion.div
            aria-hidden
            animate={{ rotate: -360 }}
            transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-300/20 border-dashed"
          >
            <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.8)]" />
          </motion.div>

          <motion.div
            whileHover={{ y: -3, scale: 1.005 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 rounded-[30px] border border-sky-300/25 bg-gradient-to-b from-sky-300/20 via-blue-400/5 to-indigo-500/10 p-[1px] shadow-[0_26px_80px_rgba(7,13,31,0.7)]"
          >
            <Card className="relative overflow-hidden rounded-[29px] border-0 bg-slate-950/85 backdrop-blur-2xl">
              <motion.div
                aria-hidden
                initial={{ left: '-55%' }}
                animate={{ left: ['-55%', '110%'] }}
                transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
                className="pointer-events-none absolute inset-y-0 w-[46%] bg-gradient-to-r from-transparent via-sky-300/24 to-transparent blur-xl"
              />
              <CardHeader className="space-y-2 border-b border-slate-300/10 pb-5">
                <div className="inline-flex w-fit items-center rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-100">
                  Acesso ao sistema
                </div>
                <CardTitle className="text-3xl font-semibold tracking-tight text-white">Entrar</CardTitle>
                <p className="text-sm text-slate-300/90">Use seu usuario e senha para acessar o painel.</p>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="identifier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Usuario</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="seu.usuario"
                              autoComplete="username"
                              className="h-11 rounded-xl border-slate-300/20 bg-slate-900/70 text-slate-100 placeholder:text-slate-400 transition focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:shadow-[0_0_0_6px_rgba(56,189,248,0.16)]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Senha</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="********"
                              autoComplete="current-password"
                              className="h-11 rounded-xl border-slate-300/20 bg-slate-900/70 text-slate-100 placeholder:text-slate-400 transition focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:shadow-[0_0_0_6px_rgba(56,189,248,0.16)]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-500 via-sky-500 to-blue-600 text-white shadow-[0_12px_30px_rgba(37,99,235,0.4)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_36px_rgba(56,189,248,0.45)]"
                      type="submit"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? 'Entrando...' : 'Entrar no painel'}
                    </Button>
                    <div className="rounded-xl border border-sky-300/20 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                      <p className="font-semibold uppercase tracking-[0.08em] text-sky-200">Credenciais demo</p>
                      <p className="mt-1">
                        Login: <span className="font-medium text-slate-100">{demoAccess.identifier}</span>
                      </p>
                      <p>
                        Senha: <span className="font-medium text-slate-100">{demoAccess.password}</span>
                      </p>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
