import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (token) {
    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'mwlab-dev-secret-2026'
      )
      await jwtVerify(token, secret)
      redirect('/dashboard')
    } catch {
      redirect('/login')
    }
  } else {
    redirect('/login')
  }
}
