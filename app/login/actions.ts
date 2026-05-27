'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function authWithPassword(formData: FormData, mode: 'login' | 'signup') {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('fullName') ?? '').trim()

  if (!email || !password) {
    redirect(`/login?error=${mode === 'login' ? 'missing-login-fields' : 'missing-signup-fields'}`)
  }

  if (mode === 'login') {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }
  } else {
    if (!fullName) {
      redirect('/login?error=missing-signup-fields')
    }

    const origin = (await headers()).get('origin')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`)
    }

    if (!data.session) {
      redirect(
        `/login?message=${encodeURIComponent(
          'Cuenta creada. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
        )}`,
      )
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function login(formData: FormData) {
  await authWithPassword(formData, 'login')
}

export async function signup(formData: FormData) {
  await authWithPassword(formData, 'signup')
}
