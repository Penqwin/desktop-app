
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useNavigate, useLocation } from "react-router-dom";
import CircularLoader from '@/assets/svg/circular_loader'

export default function LogoutButton() {
  const supabase = createClient()
  const router = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Error logging out:', error.message)
      setIsLoading(false)
    } else {
      navigate('/login')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="text-sm font-medium text-textSecondary hover:text-danger bg-secondaryBg hover:bg-border px-6 py-3 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading && <CircularLoader size={14} />}
      {isLoading ? 'Signing out…' : 'Sign Out'}
    </button>
  )
}