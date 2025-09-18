'use client'

import { useState, useEffect } from 'react'
import { 
  User,
  Save,
  Eye,
  EyeOff,
  Check,
  Pencil,
  X
} from 'lucide-react'
import DashboardLayout from '../../../components/DashboardLayout'
import DeleteAccountDialog from '../../../components/DeleteAccountDialog'
import { toast } from 'sonner'

interface UserData {
  firstName: string
  lastName: string
  email: string
  role: string
}

interface EditState {
  firstName: boolean
  lastName: boolean
  password: boolean
}

interface TempValues extends UserData {
  password?: string
  currentPassword?: string
  confirmPassword?: string
}

export default function SettingsPage() {
  const [userData, setUserData] = useState<UserData>({
    firstName: '',
    lastName: '',
    email: '',
    role: ''
  })
  
  const [editState, setEditState] = useState<EditState>({
    firstName: false,
    lastName: false,
    password: false
  })

  const [tempValues, setTempValues] = useState<TempValues>({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    password: '',
    currentPassword: '',
    confirmPassword: ''
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [isLoadingUserData, setIsLoadingUserData] = useState(true)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    setIsLoadingUserData(true)
    
    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user data')
      }

      if (!data.user) {
        throw new Error('No user data received')
      }

      setUserData({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        email: data.user.email || '',
        role: data.user.role || ''
      })
      setTempValues({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        email: data.user.email || '',
        role: data.user.role || '',
        password: '',
        currentPassword: '',
        confirmPassword: ''
      })
    } catch (error) {
      console.error('Error fetching user data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load user data')
    } finally {
      setIsLoadingUserData(false)
    }
  }

  const handleEdit = (field: keyof EditState) => {
    if (editState[field]) {
      // Save changes
      if (field === 'password') {
        handlePasswordSave()
      } else {
        handleSave(field as keyof UserData)
      }
    } else {
      // Enter edit mode
      setEditState(prev => ({
        ...prev,
        [field]: true
      }))
      setTempValues(prev => ({
        ...prev,
        [field]: userData[field as keyof UserData]
      }))
    }
  }

  const handleCancel = (field: keyof EditState) => {
    setEditState(prev => ({
      ...prev,
      [field]: false
    }))
    setTempValues(prev => ({
      ...prev,
      [field]: field === 'password' ? '' : userData[field as keyof UserData],
      ...(field === 'password' && {
        currentPassword: '',
        confirmPassword: ''
      })
    }))
  }

  const handleSave = async (field: keyof UserData) => {
    try {
      setLoading(prev => ({ ...prev, [field]: true }))
      
      const response = await fetch(`/api/users/profile/${field}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ value: tempValues[field] })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update')
      }

      const data = await response.json()
      setUserData(prev => ({
        ...prev,
        [field]: data[field]
      }))
      setEditState(prev => ({
        ...prev,
        [field]: false
      }))
      toast.success(`${field} updated successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
      setTempValues(prev => ({
        ...prev,
        [field]: userData[field]
      }))
    } finally {
      setLoading(prev => ({ ...prev, [field]: false }))
    }
  }

  const handlePasswordSave = async () => {
    try {
      setLoading(prev => ({ ...prev, password: true }))
      
      if (!tempValues.currentPassword) {
        throw new Error('Current password is required')
      }

      if (tempValues.password !== tempValues.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (!tempValues.password || tempValues.password.length < 8) {
        throw new Error('New password must be at least 8 characters long')
      }

      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          currentPassword: tempValues.currentPassword,
          newPassword: tempValues.password 
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update password')
      }

      setEditState(prev => ({
        ...prev,
        password: false
      }))
      setTempValues(prev => ({
        ...prev,
        currentPassword: '',
        password: '',
        confirmPassword: ''
      }))
      setShowPassword(false)
      toast.success('Password updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password')
    } finally {
      setLoading(prev => ({ ...prev, password: false }))
    }
  }

  const handleInputChange = (field: keyof TempValues, value: string) => {
    setTempValues(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDeleteAccount = async () => {
    // Placeholder for future implementation
    toast.info('Account deletion functionality will be implemented soon')
    setShowDeleteAccount(false)
  }

  return (
    <DashboardLayout activeTab="settings">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground text-lg">
            Manage your account settings and preferences.
          </p>
        </div>

        <div className="space-y-8">
          {/* Account Information */}
          <div className="luxury-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                  background: 'rgba(30, 30, 30, 0.5)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 25px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}>
                  <User className="w-5 h-5 text-icon-color" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Account Information</h2>
                  <p className="text-sm text-muted-foreground">Update your account details</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Role:</span>
                {isLoadingUserData ? (
                  <div className="h-6 w-16 bg-white/10 rounded-md animate-pulse"></div>
                ) : (
                  <span className="text-sm font-medium px-2 py-1 rounded-md bg-white/10 border border-white/20 backdrop-blur-sm">
                    {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                  </span>
                )}
              </div>
            </div>

            {isLoadingUserData ? (
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - Loading Skeleton */}
                <div className="space-y-6">
                  {/* First Name Skeleton */}
                  <div>
                    <div className="h-5 w-20 bg-white/10 rounded animate-pulse mb-2"></div>
                    <div className="h-12 w-full bg-white/10 rounded-lg animate-pulse"></div>
                  </div>
                  {/* Last Name Skeleton */}
                  <div>
                    <div className="h-5 w-20 bg-white/10 rounded animate-pulse mb-2"></div>
                    <div className="h-12 w-full bg-white/10 rounded-lg animate-pulse"></div>
                  </div>
                </div>
                {/* Right Column - Loading Skeleton */}
                <div className="space-y-6">
                  {/* Email Skeleton */}
                  <div>
                    <div className="h-5 w-16 bg-white/10 rounded animate-pulse mb-2"></div>
                    <div className="h-12 w-full bg-white/10 rounded-lg animate-pulse"></div>
                  </div>
                  {/* Password Skeleton */}
                  <div>
                    <div className="h-5 w-20 bg-white/10 rounded animate-pulse mb-2"></div>
                    <div className="h-12 w-full bg-white/10 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - Personal Details */}
                <div className="space-y-6">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      First Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editState.firstName ? tempValues.firstName : userData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        disabled={!editState.firstName}
                        className={`w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.firstName ? 'opacity-70' : ''}`}
                        placeholder="John"
                      />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                      {editState.firstName ? (
                        <>
                          <button
                            onClick={() => handleCancel('firstName')}
                            className="p-1 hover:text-red-400 transition-colors"
                            disabled={loading.firstName}
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSave('firstName')}
                            className="p-1 hover:text-green-400 transition-colors"
                            disabled={loading.firstName}
                          >
                            {loading.firstName ? (
                              <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEdit('firstName')}
                          className="p-1 hover:text-primary transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editState.lastName ? tempValues.lastName : userData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      disabled={!editState.lastName}
                      className={`w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm ${!editState.lastName ? 'opacity-70' : ''}`}
                      placeholder="Doe"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                      {editState.lastName ? (
                        <>
                          <button
                            onClick={() => handleCancel('lastName')}
                            className="p-1 hover:text-red-400 transition-colors"
                            disabled={loading.lastName}
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSave('lastName')}
                            className="p-1 hover:text-green-400 transition-colors"
                            disabled={loading.lastName}
                          >
                            {loading.lastName ? (
                              <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEdit('lastName')}
                          className="p-1 hover:text-primary transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={userData.email}
                      disabled
                      className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm opacity-70"
                      placeholder="john.doe@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Password */}
              <div className="space-y-6">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Current Password
                  </label>
                  {editState.password ? (
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={tempValues.currentPassword || ''}
                        onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                        className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                        placeholder="Enter current password"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="password"
                        value="••••••••"
                        disabled
                        className="w-full px-4 py-3 pr-12 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm opacity-70"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <button
                          onClick={() => handleEdit('password')}
                          className="p-1 hover:text-primary transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    New Password
                  </label>
                  {editState.password ? (
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={tempValues.password || ''}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                        placeholder="Enter new password"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="password"
                        value="••••••••"
                        disabled
                        className="w-full px-4 py-3 pr-12 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm opacity-70"
                      />
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Confirm Password
                  </label>
                  {editState.password ? (
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={tempValues.confirmPassword || ''}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm"
                        placeholder="Confirm new password"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="password"
                        value="••••••••"
                        disabled
                        className="w-full px-4 py-3 pr-12 text-base transition-all duration-300 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm opacity-70"
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons (only shown when editing) */}
                {editState.password && (
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        handleCancel('password')
                        setShowPassword(false)
                      }}
                      className="p-2 hover:text-red-400 transition-colors"
                      disabled={loading.password}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handlePasswordSave}
                      className="p-2 hover:text-green-400 transition-colors"
                      disabled={loading.password}
                    >
                      {loading.password ? (
                        <div className="w-4 h-4 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>

          {/* Account Management */}
          <div className="luxury-card p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                background: 'rgba(30, 30, 30, 0.5)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 25px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}>
                <User className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Account Management</h2>
                <p className="text-sm text-muted-foreground">Manage your account settings</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div>
                <h3 className="text-sm font-medium text-red-500 mb-1">Danger Zone</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data.
                </p>
              </div>
              <button 
                onClick={() => setShowDeleteAccount(true)}
                className="button-luxury-red py-4 text-base font-semibold"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        isOpen={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onConfirm={handleDeleteAccount}
        userEmail={userData.email}
      />
    </DashboardLayout>
  )
} 