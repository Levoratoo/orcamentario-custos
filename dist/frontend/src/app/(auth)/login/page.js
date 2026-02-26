'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoginPage;
const zod_1 = require("zod");
const react_hook_form_1 = require("react-hook-form");
const zod_2 = require("@hookform/resolvers/zod");
const framer_motion_1 = require("framer-motion");
const auth_provider_1 = require("@/components/providers/auth-provider");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const form_1 = require("@/components/ui/form");
const input_1 = require("@/components/ui/input");
const sonner_1 = require("sonner");
const errors_1 = require("@/lib/api/errors");
const schema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalido'),
    password: zod_1.z.string().min(6, 'Minimo 6 caracteres'),
});
function LoginPage() {
    const { login } = (0, auth_provider_1.useAuth)();
    const form = (0, react_hook_form_1.useForm)({
        resolver: (0, zod_2.zodResolver)(schema),
        defaultValues: { email: '', password: '' },
    });
    const onSubmit = async (values) => {
        try {
            await login(values.email, values.password);
        }
        catch (error) {
            sonner_1.toast.error((0, errors_1.getErrorMessage)(error, 'Falha ao entrar'));
        }
    };
    return (<div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_40%)]"/>
      <framer_motion_1.motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <card_1.Card className="border-0 bg-card/80 shadow-2xl backdrop-blur">
          <card_1.CardHeader>
            <card_1.CardTitle className="text-2xl">Planejamento Orcamentario</card_1.CardTitle>
            <p className="text-sm text-muted-foreground">Acesse seu painel de planejamento Printbag.</p>
          </card_1.CardHeader>
          <card_1.CardContent>
            <form_1.Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <form_1.FormField control={form.control} name="email" render={({ field }) => (<form_1.FormItem>
                      <form_1.FormLabel>Email</form_1.FormLabel>
                      <form_1.FormControl>
                        <input_1.Input placeholder="voce@empresa.com" {...field}/>
                      </form_1.FormControl>
                      <form_1.FormMessage />
                    </form_1.FormItem>)}/>
                <form_1.FormField control={form.control} name="password" render={({ field }) => (<form_1.FormItem>
                      <form_1.FormLabel>Senha</form_1.FormLabel>
                      <form_1.FormControl>
                        <input_1.Input type="password" placeholder="********" {...field}/>
                      </form_1.FormControl>
                      <form_1.FormMessage />
                    </form_1.FormItem>)}/>
                <button_1.Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
                </button_1.Button>
              </form>
            </form_1.Form>
          </card_1.CardContent>
        </card_1.Card>
      </framer_motion_1.motion.div>
    </div>);
}
//# sourceMappingURL=page.js.map