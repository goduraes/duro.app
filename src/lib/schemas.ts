import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome').max(80, 'Nome muito longo'),
    email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
    password: z.string().min(8, 'Mínimo de 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As senhas não coincidem',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Mínimo de 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As senhas não coincidem',
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(80, 'Nome muito longo'),
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Informe a senha atual'),
    password: z.string().min(8, 'Mínimo de 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As senhas não coincidem',
  });

export const recurringSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    description: z.string().trim().min(1, 'Informe a descrição').max(120, 'Máximo de 120 caracteres'),
    amount: z
      .number('Informe o valor')
      .positive('O valor deve ser maior que zero')
      .max(21_000_000, 'Valor muito alto'),
    day_of_month: z
      .number('Informe o dia')
      .int('Informe um dia válido')
      .min(1, 'Dia entre 1 e 31')
      .max(31, 'Dia entre 1 e 31'),
    start_date: z.string('Informe o mês de início').regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o mês de início'),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Mês final inválido')
      .nullable(),
    tag_ids: z.array(z.string()),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'O mês final deve ser igual ou posterior ao inicial',
  });

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(40, 'Máximo de 40 caracteres'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida'),
});

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1, 'Informe a descrição').max(120, 'Máximo de 120 caracteres'),
  amount: z
    .number('Informe o valor')
    .positive('O valor deve ser maior que zero')
    .max(21_000_000, 'Valor muito alto'),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
  tag_ids: z.array(z.string()),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type RecurringValues = z.infer<typeof recurringSchema>;
export type TagValues = z.infer<typeof tagSchema>;
export type TransactionValues = z.infer<typeof transactionSchema>;
