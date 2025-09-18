'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CreditCard,
  Calendar,
  BarChart3,
  TrendingUp,
  Zap,
  Clock,
  DollarSign,
  Download,
  Settings,
  Plus,
  Check,
  Star,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Filter,
  Pencil,
  X,
  RefreshCw,
  Trash2,
  Edit,
  CalendarDays,
  Search,
  Wallet,
  Target,
  Activity,
  Shield
} from 'lucide-react'
import PaymentMethodDialog from '../../../components/PaymentMethodDialog'
import DashboardLayout from '../../../components/DashboardLayout'
import { toast } from 'sonner'

interface UsageRecord {
  id: string
  userId: string
  tokens: number
  model: string
  cost: number
  createdAt: string
}

interface Plan {
  id: string
  name: string
  price: number
  period: string
  tokens: string
  features: string[]
  popular?: boolean
}

interface PaymentMethod {
  id: string
  type: string
  last4: string
  expiry: string
  brand: string
}

interface Purchase {
  id: string
  type: string
  amount: number
  currency: string
  tokens?: number
  description: string
  status: string
  createdAt: string
}

interface Subscription {
  id: string | null
  status: string | null
  endDate: string | null
}

interface DateRangePickerProps {
  startDate: Date | null
  endDate: Date | null
  onStartDateChange: (date: Date | null) => void
  onEndDateChange: (date: Date | null) => void
  onClose: () => void
  onApplyFilter: () => void
  onClearFilter: () => void
}

function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange, onClose, onApplyFilter, onClearFilter }: DateRangePickerProps) {
  // Set initial month based on selected dates, or current month if no selection
  const getInitialMonth = useCallback(() => {
    if (startDate) return new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    if (endDate) return new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    return new Date()
  }, [startDate, endDate])
  
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth())
  const [selectingStart, setSelectingStart] = useState(true)

  // Update current month when dates change (when calendar opens)
  useEffect(() => {
    const newMonth = getInitialMonth()
    setCurrentMonth(newMonth)
  }, [startDate, endDate, getInitialMonth])

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false
    return date >= startDate && date <= endDate
  }

  const isDateSelected = (date: Date) => {
    if (!startDate && !endDate) return false
    return (startDate && date.toDateString() === startDate.toDateString()) ||
           (endDate && date.toDateString() === endDate.toDateString())
  }

  const handleDateClick = (date: Date) => {
    if (selectingStart) {
      onStartDateChange(date)
      setSelectingStart(false)
      if (endDate && date > endDate) {
        onEndDateChange(null)
      }
    } else {
      if (startDate && date < startDate) {
        onStartDateChange(date)
        onEndDateChange(startDate)
      } else {
        onEndDateChange(date)
      }
      setSelectingStart(true)
    }
  }

  const navigateMonth = (direction: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1))
  }

  const days = getDaysInMonth(currentMonth)

    return (
    <div className="p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="ml-1">
          <h3 className="text-sm font-semibold text-foreground">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="w-3 h-3 rotate-90" />
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="w-3 h-3 -rotate-90" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="p-0.5 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {days.map((date, index) => (
          <div key={index} className="aspect-square">
            {date ? (
              <button
                onClick={() => handleDateClick(date)}
                className={`w-full h-full rounded-lg text-sm font-medium transition-all duration-200 ${
                  isDateSelected(date)
                    ? 'text-white'
                    : isDateInRange(date)
                    ? 'text-foreground bg-white/20'
                    : 'text-foreground hover:bg-white/10'
                }`}
                                style={isDateSelected(date) ? {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid #2D8EFF'
                } : {}}
              >
                {date.getDate()}
              </button>
            ) : (
              <div />
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center pt-2 border-t border-white/10">
        <button
          onClick={() => {
            onClearFilter()
            onClose()
          }}
          className="px-2 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear Filter
        </button>
        <button
          onClick={() => {
            onApplyFilter()
            onClose()
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-all duration-500 hover:scale-105 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            transform: 'translateY(0)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
          }}
        >
          {/* Shimmer effect */}
          <div 
            className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
              transform: 'translateX(-100%)'
            }}
          ></div>
          Filter
        </button>
      </div>

    </div>
  )
}

interface BuyTokensDialogProps {
  isOpen: boolean;
  onClose: () => void;
  hasPaymentMethod: boolean;
  onSuccess: () => void;
}

function BuyTokensDialog({ isOpen, onClose, hasPaymentMethod, onSuccess }: BuyTokensDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(1000000); // 1M tokens default
  const shimmerTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const tokenOptions = [
    { value: 1000000, label: '1M tokens - $10' },
    { value: 5000000, label: '5M tokens - $45' },
    { value: 10000000, label: '10M tokens - $85' },
    { value: 25000000, label: '25M tokens - $200' },
  ];

  if (!isOpen) return null;

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/purchase-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tokens: selectedAmount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to purchase tokens');
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Successfully purchased ${selectedAmount.toLocaleString()} tokens for $${data.cost}!`);
        onClose();
        onSuccess();
      } else {
        throw new Error(data.message || 'Purchase failed');
      }
    } catch (error) {
      console.error('Error purchasing tokens:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to purchase tokens');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-foreground">Buy Tokens</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <select
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              className="w-full px-4 py-3 text-base transition-all duration-300 text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:outline-none border rounded-lg bg-white/10 border-white/20 backdrop-blur-sm appearance-none"
              disabled={loading}
            >
              {tokenOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[rgb(30,30,30)]">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={loading}
              className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                transform: 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  
                  // Trigger shimmer effect
                  const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                  if (shimmer) {
                    const existingTimeout = shimmerTimeoutsRef.current.get('buyTokensConfirm');
                    if (existingTimeout) {
                      clearTimeout(existingTimeout);
                    }
                    
                    shimmer.style.transition = 'transform 0.5s ease-out';
                    shimmer.style.transform = 'translateX(100%)';
                    const timeout = setTimeout(() => {
                      shimmer.style.transition = 'none';
                      shimmer.style.transform = 'translateX(-100%)';
                      shimmerTimeoutsRef.current.delete('buyTokensConfirm');
                    }, 500);
                    shimmerTimeoutsRef.current.set('buyTokensConfirm', timeout);
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
              }}
            >
              {/* Shimmer effect */}
              <div 
                className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  transform: 'translateX(-100%)'
                }}
              ></div>
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                'Purchase'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter()
  const shimmerTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  // State management
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [showBuyTokens, setShowBuyTokens] = useState(false)
  const [showPlanChange, setShowPlanChange] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [autoTopUp, setAutoTopUp] = useState({
    enabled: false,
    threshold: 10000,
    amount: 15000000
  })
  const [autoTopUpEditState, setAutoTopUpEditState] = useState({
    threshold: false,
    amount: false
  })
  const [autoTopUpTempValues, setAutoTopUpTempValues] = useState({
    threshold: 10000,
    amount: 15000000
  })
  const [autoTopUpLoading, setAutoTopUpLoading] = useState<Record<string, boolean>>({})
  const [autoTopUpHistory, setAutoTopUpHistory] = useState<any[]>([])
  const [showAutoTopUpHistory, setShowAutoTopUpHistory] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [userPlan, setUserPlan] = useState('free')
  const [tokenInfo, setTokenInfo] = useState({
    tokensUsed: 0,
    tokensLimit: 1000000,
    tokenBalance: 1000000
  })
  const [monthlyUsage, setMonthlyUsage] = useState({
    tokens: 0,
    cost: 0
  })
  const [topUpAmount, setTopUpAmount] = useState(10000)
  const [startDate, setStartDate] = useState<Date | null>(null) // No initial filter
  const [endDate, setEndDate] = useState<Date | null>(null)
  // Temporary states for calendar selection (not applied until "Filter" is clicked)
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreRecords, setHasMoreRecords] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPurchases, setTotalPurchases] = useState(0)
  const [currentPurchaseOffset, setCurrentPurchaseOffset] = useState(0)
  const [hasMorePurchases, setHasMorePurchases] = useState(false)
  const [loadingMorePurchases, setLoadingMorePurchases] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([])
  const [subscription, setSubscription] = useState<Subscription>({
    id: null,
    status: null,
    endDate: null
  })
  const datePickerRef = useRef<HTMLDivElement>(null)



  // Plans data
  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: 'month',
      tokens: '200K daily',
      features: ['200K tokens daily', 'Basic support', 'Community access']
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 20,
      period: 'month',
      tokens: '12M monthly',
      features: ['12M tokens monthly', 'Priority support', 'Advanced features', 'API access'],
      popular: true
    },
    {
      id: 'business',
      name: 'Business',
      price: 50,
      period: 'month',
      tokens: '35M monthly',
      features: ['35M tokens monthly', '24/7 support', 'Custom integrations', 'Team collaboration', 'Advanced analytics']
    }
  ]





  // Fetch initial usage records (for date filter changes)
  const fetchInitialRecords = useCallback(async () => {
    setLoading(true)
    setCurrentOffset(0)
    setHasMoreRecords(false)
    setTotalRecords(0)
    // Reset purchase pagination state
    setCurrentPurchaseOffset(0)
    setHasMorePurchases(false)
    setTotalPurchases(0)
    
    try {
      const params = new URLSearchParams()
      if (startDate) {
        params.append('from', startDate.toISOString())
      }
      if (endDate) {
        params.append('to', endDate.toISOString())
      }
      params.append('limit', '100')
      params.append('offset', '0')
      
      const apiUrl = `/api/usage?${params.toString()}`
      const response = await fetch(apiUrl)
      const data = await response.json()
      
      if (data.success) {
        setUsageRecords(data.records || [])
        setCurrentOffset(100)
        setTotalRecords(data.total || 0)
        setHasMoreRecords((data.records?.length || 0) === 100 && 100 < (data.total || 0))
        
        // Update auto top-up settings if included in response
        if (data.autoTopUp) {
          setAutoTopUp({
            enabled: data.autoTopUp.enabled,
            threshold: data.autoTopUp.threshold,
            amount: data.autoTopUp.amount
          })
          setAutoTopUpTempValues({
            threshold: data.autoTopUp.threshold,
            amount: data.autoTopUp.amount
          })
        }
        
        // Update user plan if included in response
        if (data.user?.plan) {
          setUserPlan(data.user.plan)
        }
        
        // Update token information if included in response
        if (data.user) {
          setTokenInfo({
            tokensUsed: data.user.tokensUsed || 0,
            tokensLimit: data.user.tokensLimit || 1000000,
            tokenBalance: data.user.tokenBalance || 1000000
          })
        }
        
        // Update monthly usage if included in response
        if (data.monthlyUsage) {
          setMonthlyUsage({
            tokens: data.monthlyUsage.tokens || 0,
            cost: data.monthlyUsage.cost || 0
          })
        }
        
        // Update payment methods if included in response
        if (data.paymentMethods) {
          setPaymentMethods(data.paymentMethods)
        }
        
        // Update recent purchases if included in response
        if (data.recentPurchases) {
          setRecentPurchases(data.recentPurchases)
          setCurrentPurchaseOffset(20) // First 20 purchases loaded
        }
        
        // Update purchase pagination info
        if (data.totalPurchases !== undefined) {
          setTotalPurchases(data.totalPurchases)
          setHasMorePurchases(data.recentPurchases && data.recentPurchases.length === 20 && 20 < data.totalPurchases)
        }
        
        // Update subscription if included in response
        if (data.subscription) {
          setSubscription({
            id: data.subscription.id,
            status: data.subscription.status,
            endDate: data.subscription.endDate
          })
        }
      }
    } catch (error) {
      toast.error('Failed to fetch usage records')
    } finally {
      setLoading(false)
      setIsInitialLoading(false)
    }
  }, [startDate, endDate])

  // Initialize data on component mount
  useEffect(() => {
    const plan = plans.find(p => p.id === userPlan)
    setCurrentPlan(plan || plans[0])
    fetchInitialRecords()
  }, []) // Only run on mount

  // Fetch more usage records (for pagination)
  const fetchMoreRecords = useCallback(async () => {
    if (!hasMoreRecords || loadingMore) return
    
    setLoadingMore(true)
    
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('from', startDate.toISOString())
      if (endDate) params.append('to', endDate.toISOString())
      params.append('limit', '100')
      params.append('offset', currentOffset.toString())
      
      const response = await fetch(`/api/usage?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        const newOffset = currentOffset + 100
        setUsageRecords(prev => [...prev, ...(data.records || [])])
        setCurrentOffset(newOffset)
        setHasMoreRecords((data.records?.length || 0) === 100 && newOffset < (data.total || 0))
      }
    } catch (error) {
      toast.error('Failed to fetch more records')
    } finally {
      setLoadingMore(false)
    }
  }, [startDate, endDate, currentOffset, hasMoreRecords, loadingMore])

  // Fetch more purchase records (for pagination)
  const fetchMorePurchases = useCallback(async () => {
    if (!hasMorePurchases || loadingMorePurchases) return
    
    setLoadingMorePurchases(true)
    
    try {
      const params = new URLSearchParams()
      params.append('limit', '20')
      params.append('offset', currentPurchaseOffset.toString())
      
      const response = await fetch(`/api/usage/purchases?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        const newOffset = currentPurchaseOffset + 20
        setRecentPurchases(prev => [...prev, ...(data.purchases || [])])
        setCurrentPurchaseOffset(newOffset)
        setHasMorePurchases((data.purchases?.length || 0) === 20 && newOffset < (data.total || 0))
      }
    } catch (error) {
      toast.error('Failed to fetch more purchase records')
    } finally {
      setLoadingMorePurchases(false)
    }
  }, [currentPurchaseOffset, hasMorePurchases, loadingMorePurchases])

  // Apply filter function - updates actual filter dates and triggers fetch
  const applyFilter = useCallback(() => {
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
  }, [tempStartDate, tempEndDate])

  // Clear filter function - directly clears both temp and actual dates
  const clearFilter = useCallback(() => {
    setTempStartDate(null)
    setTempEndDate(null)
    setStartDate(null)
    setEndDate(null)
  }, [])

  // Show delete confirmation dialog
  const handleDeletePaymentMethod = useCallback((paymentMethodId: string) => {
    setPaymentMethodToDelete(paymentMethodId)
    setShowDeleteConfirmation(true)
  }, [])

  // Confirm delete payment method
  const confirmDeletePaymentMethod = useCallback(async () => {
    if (!paymentMethodToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/billing/payment-methods/${paymentMethodToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete payment method')
      }

      const data = await response.json()
      if (data.success) {
        toast.success('Payment method deleted successfully')
        // Refresh billing data to update payment methods list
        fetchInitialRecords()
        setShowDeleteConfirmation(false)
        setPaymentMethodToDelete(null)
      } else {
        throw new Error(data.message || 'Failed to delete payment method')
      }
    } catch (error) {
      console.error('Error deleting payment method:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete payment method')
    } finally {
      setIsDeleting(false)
    }
  }, [paymentMethodToDelete, fetchInitialRecords])

  // Reset pagination and fetch new data when date range changes
  useEffect(() => {
    fetchInitialRecords()
  }, [startDate, endDate]) // Remove fetchInitialRecords from deps to avoid loop

  // Click outside to close date picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      // Don't close if clicking on the date picker or the trigger button
      if (datePickerRef.current && !datePickerRef.current.contains(target)) {
        // Also check if we're clicking on the trigger button
        const triggerButton = document.querySelector('[data-calendar-trigger]')
        if (triggerButton && triggerButton.contains(target)) {
          return // Don't close if clicking the trigger button
        }
        setShowDatePicker(false)
      }
    }

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDatePicker])

  // Export usage to CSV
  const exportUsageCSV = () => {
    const headers = ['Date', 'Model', 'Tokens', 'Cost']
    const csvContent = [
      headers.join(','),
      ...usageRecords.map(record => [
        new Date(record.createdAt).toLocaleDateString(),
        record.model,
        record.tokens,
        `$${record.cost.toFixed(4)}`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Usage data exported successfully!')
  }

  // Export purchases to CSV
  const exportPurchasesCSV = () => {
    const headers = ['Date', 'Description', 'Tokens', 'Amount', 'Status', 'Type', 'Currency']
    const csvContent = [
      headers.join(','),
      ...recentPurchases.map(purchase => [
        new Date(purchase.createdAt).toLocaleDateString(),
        `"${purchase.description}"`, // Wrap in quotes in case description contains commas
        purchase.tokens || '',
        `$${purchase.amount.toFixed(2)}`,
        purchase.status,
        purchase.type,
        purchase.currency
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `purchases-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Purchase history exported successfully!')
  }



  // Handle plan change
  const handlePlanChange = async (planId: string) => {
    try {
      const response = await fetch('/api/billing/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`Successfully switched to ${planId} plan`)
        setCurrentPlan(plans.find(p => p.id === planId) || plans[0])
        setShowPlanChange(false)
      } else {
        toast.error(data.error || 'Failed to change plan')
      }
    } catch (error) {
      toast.error('Failed to change plan')
    }
  }

  // Handle auto top-up toggle (only for enable/disable)
  const handleAutoTopUpToggle = async (settings: typeof autoTopUp) => {
    try {
      const response = await fetch('/api/billing/auto-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await response.json()
      if (data.success) {
        setAutoTopUp(settings)
        toast.success(`Auto top-up ${settings.enabled ? 'enabled' : 'disabled'}`)
      } else {
        // Show more helpful error messages for payment method issues
        if (data.error === 'Payment method required') {
          toast.error(data.message || 'Please add a payment method before enabling auto top-up')
        } else {
          toast.error(data.error || 'Failed to update auto top-up')
        }
      }
    } catch (error) {
      toast.error('Failed to update auto top-up')
    }
  }

  // Handle auto top-up settings update (silent, no toast)
  const updateAutoTopUpSettings = async (settings: typeof autoTopUp) => {
    try {
      const response = await fetch('/api/billing/auto-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await response.json()
      if (data.success) {
        setAutoTopUp(settings)
      } else {
        toast.error(data.error || 'Failed to update auto top-up settings')
      }
    } catch (error) {
      toast.error('Failed to update auto top-up settings')
    }
  }

  // Handle auto top-up field edit/save
  const handleAutoTopUpEdit = (field: 'threshold' | 'amount') => {
    if (autoTopUpEditState[field]) {
      // Save changes
      handleAutoTopUpSave(field)
    } else {
      // Enter edit mode
      setAutoTopUpEditState(prev => ({
        ...prev,
        [field]: true
      }))
      setAutoTopUpTempValues(prev => ({
        ...prev,
        [field]: autoTopUp[field]
      }))
    }
  }

  const handleAutoTopUpCancel = (field: 'threshold' | 'amount') => {
    setAutoTopUpEditState(prev => ({
      ...prev,
      [field]: false
    }))
    setAutoTopUpTempValues(prev => ({
      ...prev,
      [field]: autoTopUp[field]
    }))
  }

  const handleAutoTopUpSave = async (field: 'threshold' | 'amount') => {
    try {
      setAutoTopUpLoading(prev => ({ ...prev, [field]: true }))
      
      const newValue = autoTopUpTempValues[field]
      const minValue = field === 'threshold' ? 10000 : 15000000
      
      if (newValue < minValue) {
        toast.error(`Minimum ${field} is ${minValue.toLocaleString()} tokens`)
        return
      }

      const updatedSettings = {
        ...autoTopUp,
        [field]: newValue
      }

      const response = await fetch('/api/billing/auto-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      })
      
      const data = await response.json()
      if (data.success) {
        setAutoTopUp(updatedSettings)
        setAutoTopUpEditState(prev => ({
          ...prev,
          [field]: false
        }))
        toast.success(`Auto top-up ${field} updated successfully`)
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
      setAutoTopUpTempValues(prev => ({
        ...prev,
        [field]: autoTopUp[field]
      }))
    } finally {
      setAutoTopUpLoading(prev => ({ ...prev, [field]: false }))
    }
  }

  const handleAutoTopUpInputChange = (field: 'threshold' | 'amount', value: string) => {
    const numValue = parseInt(value) || 0
    setAutoTopUpTempValues(prev => ({
      ...prev,
      [field]: numValue
    }))
  }

  // Fetch auto top-up history
  const fetchAutoTopUpHistory = async () => {
    try {
      const response = await fetch('/api/billing/auto-topup/history')
      const data = await response.json()
      if (data.success) {
        setAutoTopUpHistory(data.history)
      }
    } catch (error) {
      console.error('Failed to fetch auto top-up history:', error)
    }
  }

  // Manual auto top-up trigger (for testing)
  const handleManualAutoTopUp = async () => {
    try {
      setAutoTopUpLoading(prev => ({ ...prev, manual: true }))
      const response = await fetch('/api/billing/auto-topup/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      
      if (data.success) {
        toast.success(`Auto top-up successful! Added ${data.tokensAdded?.toLocaleString()} tokens`)
        fetchInitialRecords() // Refresh data
        fetchAutoTopUpHistory() // Refresh history
      } else {
        toast.error(data.error || 'Auto top-up failed')
      }
    } catch (error) {
      toast.error('Failed to trigger auto top-up')
    } finally {
      setAutoTopUpLoading(prev => ({ ...prev, manual: false }))
    }
  }

  const usagePercentage = (tokenInfo.tokensUsed / tokenInfo.tokensLimit) * 100

  // Calculate if user has payment methods
  const hasPaymentMethod = paymentMethods.length > 0

  // Format plan name for display
  const formatPlanName = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'free':
        return 'Free Plan'
      case 'starter':
        return 'Starter Plan'
      case 'business':
        return 'Business Plan'
      default:
        return `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`
    }
  }

  return (
    <DashboardLayout activeTab="billing">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-foreground">Billing & Usage</h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Current Plan:</span>
              {isInitialLoading ? (
                <div className="h-5 w-24 bg-secondary/50 rounded animate-pulse"></div>
              ) : (
                <button
                  onClick={() => router.push('/pricing')}
                  className="text-sm app-link-highlight"
                >
                  {formatPlanName(userPlan)}
                </button>
              )}
              {!isInitialLoading && (['free','starter'].includes(userPlan)) && (
                <button
                  onClick={() => router.push('/pricing')}
                  className="flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full transition-all duration-500 hover:scale-105 relative overflow-hidden border border-white/20 ml-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    
                    // Trigger shimmer effect
                    const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                    if (shimmer) {
                      const existingTimeout = shimmerTimeoutsRef.current.get('upgradeHeader');
                      if (existingTimeout) {
                        clearTimeout(existingTimeout);
                      }
                      
                      shimmer.style.transition = 'transform 0.5s ease-out';
                      shimmer.style.transform = 'translateX(100%)';
                      const timeout = setTimeout(() => {
                        shimmer.style.transition = 'none';
                        shimmer.style.transform = 'translateX(-100%)';
                        shimmerTimeoutsRef.current.delete('upgradeHeader');
                      }, 500);
                      shimmerTimeoutsRef.current.set('upgradeHeader', timeout);
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  <div className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                    transform: 'translateX(-100%)'
                  }}></div>
                  Upgrade
                </button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage your subscription, tokens, and usage analytics.
          </p>
        </div>

        <div className="space-y-8">
          {/* Account Overview */}
    <div className="luxury-card p-6">
            <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
            background: 'rgba(30, 30, 30, 0.5)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 25px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}>
                  <Wallet className="w-5 h-5 text-icon-color" />
          </div>
          <div>
                  <h2 className="text-xl font-semibold text-foreground">Account Overview</h2>
                  <p className="text-sm text-muted-foreground">Token balance, usage, and payment methods</p>
          </div>
        </div>
                            <div className="relative inline-block group">
                <button
                  onClick={() => setShowBuyTokens(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    
                    // Trigger shimmer effect
                    const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                    if (shimmer) {
                      const existingTimeout = shimmerTimeoutsRef.current.get('buyTokens');
                      if (existingTimeout) {
                        clearTimeout(existingTimeout);
                      }
                      
                      shimmer.style.transition = 'transform 0.5s ease-out';
                      shimmer.style.transform = 'translateX(100%)';
                      const timeout = setTimeout(() => {
                        shimmer.style.transition = 'none';
                        shimmer.style.transform = 'translateX(-100%)';
                        shimmerTimeoutsRef.current.delete('buyTokens');
                      }, 500);
                      shimmerTimeoutsRef.current.set('buyTokens', timeout);
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  <div className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                    transform: 'translateX(-100%)'
                  }}></div>
                  <Wallet className="w-4 h-4" />
                  Buy Tokens
                </button>
        </div>
      </div>
      
            {/* Reorganized Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Available Tokens */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-muted-foreground">Available Tokens</div>
                  {isInitialLoading ? (
                    <div className="h-5 w-20 bg-secondary/50 rounded animate-pulse"></div>
                  ) : (
                    <div className="text-sm font-bold text-foreground h-5 flex items-center">{tokenInfo.tokenBalance.toLocaleString()}</div>
                  )}
        </div>
                <div className="border-t border-white/10 h-[60px] flex">
                  <div className="w-full my-auto px-1">
                    {isInitialLoading ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="h-3 w-16 bg-secondary/50 rounded animate-pulse"></div>
                          <div className="h-3 w-16 bg-secondary/50 rounded animate-pulse"></div>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div className="h-2 w-1/3 bg-secondary/50 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-muted-foreground">Used: {tokenInfo.tokensUsed.toLocaleString()}</span>
                          <span className="text-muted-foreground">Limit: {tokenInfo.tokensLimit.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min((tokenInfo.tokensUsed / tokenInfo.tokensLimit) * 100, 100)}%`,
                              background: 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)',
                              boxShadow: '0 0 10px rgba(45, 142, 255, 0.3)'
                            }}
                          ></div>
                        </div>
                      </>
                    )}
    </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-muted-foreground">Payment Methods</div>
                  {!isInitialLoading && paymentMethods.length === 0 && (
                    <button 
                      onClick={() => setShowAddPayment(true)}
                      className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    >
                    <Plus className="w-3 h-3" />
                  </button>
                  )}
            </div>
                <div className="flex flex-col justify-center space-y-2 pt-2 border-t border-white/10 min-h-[60px]">
                  {isInitialLoading ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-secondary/50 rounded animate-pulse"></div>
                        <div className="space-y-1">
                          <div className="h-3 w-12 bg-secondary/50 rounded animate-pulse"></div>
                          <div className="h-2 w-8 bg-secondary/50 rounded animate-pulse"></div>
                        </div>
                      </div>
                      <div className="w-3 h-3 bg-secondary/50 rounded animate-pulse"></div>
                    </div>
                  ) : paymentMethods.length > 0 ? (
                    <>
                      {paymentMethods.slice(0, 1).map((method) => (
                        <div key={method.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                          <div className="flex items-center space-x-2">
                            <CreditCard className="w-3 h-3 text-muted-foreground" />
              <div>
                              <div className="text-xs font-medium text-foreground">•••• {method.last4}</div>
                              <div className="text-xs text-muted-foreground">{method.brand?.toUpperCase() || method.type.toUpperCase()}</div>
            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePaymentMethod(method.id)}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete payment method"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {paymentMethods.length > 1 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{paymentMethods.length - 1} more
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <div className="text-xs text-muted-foreground">
                        No payment methods added
                      </div>
                      <button
                        onClick={() => setShowAddPayment(true)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                          backdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                          color: '#ffffff',
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                          
                          const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                          if (shimmer) {
                            shimmer.style.transition = 'transform 0.5s ease-out';
                            shimmer.style.transform = 'translateX(100%)';
                            setTimeout(() => {
                              shimmer.style.transition = 'none';
                              shimmer.style.transform = 'translateX(-100%)';
                            }, 500);
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                      >
                        <div 
                          className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                          style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                            transform: 'translateX(-100%)'
                          }}
                        ></div>
                        Add Payment Method
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto Top-Up */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-muted-foreground">Auto Top-Up</div>
                  <div className="relative group">
                    <button
                      onClick={() => hasPaymentMethod ? handleAutoTopUpToggle({ ...autoTopUp, enabled: !autoTopUp.enabled }) : null}
                      disabled={!hasPaymentMethod}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 ${
                        !hasPaymentMethod ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      style={{
                        background: autoTopUp.enabled 
                          ? 'linear-gradient(135deg, #2E2A5D 0%, #5A3F9E 25%, #2D8EFF 75%, #00D2C6 100%)'
                          : 'rgba(255, 255, 255, 0.2)',
                        boxShadow: autoTopUp.enabled 
                          ? '0 0 8px rgba(45, 142, 255, 0.4)'
                          : 'none'
                      }}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          autoTopUp.enabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    {!hasPaymentMethod && (
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 bottom-[120%] bg-black/90 px-3 py-1.5 rounded text-xs text-white whitespace-nowrap z-50 hidden group-hover:block"
                        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)' }}
                      >
                        Add a payment method to enable auto top-up
                      </div>
                    )}
                  </div>
              </div>
                
                                  {autoTopUp.enabled && (
                    <div className="flex flex-col justify-center space-y-2 pt-2 border-t border-white/10 min-h-[60px]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Trigger</span>
                        <div className="relative flex items-center">
                <input 
                            type="number"
                            value={autoTopUpEditState.threshold ? autoTopUpTempValues.threshold : autoTopUp.threshold}
                            onChange={(e) => handleAutoTopUpInputChange('threshold', e.target.value)}
                            disabled={!autoTopUpEditState.threshold}
                            min="10000"
                            placeholder="10000"
                            className={`text-xs px-2 py-1 rounded bg-white/10 border border-white/20 text-foreground w-20 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!autoTopUpEditState.threshold ? 'opacity-70' : ''}`}
                          />
                          <div className="ml-2 flex space-x-1">
                            {autoTopUpEditState.threshold ? (
                              <>
                                <button
                                  onClick={() => handleAutoTopUpCancel('threshold')}
                                  className="p-1 hover:text-red-400 transition-colors"
                                  disabled={autoTopUpLoading.threshold}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleAutoTopUpEdit('threshold')}
                                  className="p-1 hover:text-green-400 transition-colors"
                                  disabled={autoTopUpLoading.threshold}
                                >
                                  {autoTopUpLoading.threshold ? (
                                    <div className="w-3 h-3 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleAutoTopUpEdit('threshold')}
                                className="p-1 hover:text-primary transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
              </div>
            </div>
          </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Amount</span>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={autoTopUpEditState.amount ? autoTopUpTempValues.amount : autoTopUp.amount}
                            onChange={(e) => handleAutoTopUpInputChange('amount', e.target.value)}
                            disabled={!autoTopUpEditState.amount}
                            min="15000000"
                            placeholder="15000000"
                            className={`text-xs px-2 py-1 rounded bg-white/10 border border-white/20 text-foreground w-20 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!autoTopUpEditState.amount ? 'opacity-70' : ''}`}
                          />
                          <div className="ml-2 flex space-x-1">
                            {autoTopUpEditState.amount ? (
                              <>
            <button 
                                  onClick={() => handleAutoTopUpCancel('amount')}
                                  className="p-1 hover:text-red-400 transition-colors"
                                  disabled={autoTopUpLoading.amount}
            >
                                  <X className="w-3 h-3" />
            </button>
            <button 
                                  onClick={() => handleAutoTopUpEdit('amount')}
                                  className="p-1 hover:text-green-400 transition-colors"
                                  disabled={autoTopUpLoading.amount}
                                >
                                  {autoTopUpLoading.amount ? (
                                    <div className="w-3 h-3 border-2 border-t-transparent border-green-400 rounded-full animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
            </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleAutoTopUpEdit('amount')}
                                className="p-1 hover:text-primary transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
          </div>
        </div>
      </div>
                    </div>
                  )}

                  {/* Show warning if no payment method */}
                  {!hasPaymentMethod}
              </div>
            </div>
        </div>

          {/* Usage Analytics */}
          <div className="luxury-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'rgba(30, 30, 30, 0.5)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 25px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}>
                  <BarChart3 className="w-5 h-5 text-icon-color" />
            </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Usage Analytics</h2>
                  <p className="text-sm text-muted-foreground">Track your token usage and costs</p>
          </div>
              </div>
              <button
                onClick={exportUsageCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  color: '#ffffff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';

                  // Trigger shimmer effect
                  const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                  if (shimmer) {
                    const existingTimeout = shimmerTimeoutsRef.current.get('export');
                    if (existingTimeout) {
                      clearTimeout(existingTimeout);
                    }
                    
                    shimmer.style.transition = 'transform 0.5s ease-out';
                    shimmer.style.transform = 'translateX(100%)';
                    const timeout = setTimeout(() => {
                      shimmer.style.transition = 'none';
                      shimmer.style.transform = 'translateX(-100%)';
                      shimmerTimeoutsRef.current.delete('export');
                    }, 500);
                    shimmerTimeoutsRef.current.set('export', timeout);
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <div className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none" style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  transform: 'translateX(-100%)'
                }}></div>
                <Download className="w-4 h-4" />
                <span>Export .CSV</span>
              </button>
        </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <button
                    data-calendar-trigger
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!showDatePicker) {
                        // Sync temp dates with current applied dates when opening
                        // If no filter is applied, keep temp dates as null (no selection)
                        setTempStartDate(startDate)
                        setTempEndDate(endDate)
                      }
                      setShowDatePicker(!showDatePicker)
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                      color: '#ffffff'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                      
                      // Trigger shimmer effect
                      const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                      if (shimmer) {
                        const existingTimeout = shimmerTimeoutsRef.current.get('calendar');
                        if (existingTimeout) {
                          clearTimeout(existingTimeout);
                        }
                        
                        shimmer.style.transition = 'transform 0.5s ease-out';
                        shimmer.style.transform = 'translateX(100%)';
                        const timeout = setTimeout(() => {
                          shimmer.style.transition = 'none';
                          shimmer.style.transform = 'translateX(-100%)';
                          shimmerTimeoutsRef.current.delete('calendar');
                        }, 500);
                        shimmerTimeoutsRef.current.set('calendar', timeout);
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    <div className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                      transform: 'translateX(-100%)'
                    }}></div>
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">
                      {startDate && endDate 
                        ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                        : 'All time'
                      }
                    </span>
                    <ChevronDown className="w-4 h-4" />
              </button>
                  
                  {showDatePicker && (
                    <div 
                      ref={datePickerRef}
                      className="absolute top-full left-0 mt-2 rounded-xl border shadow-2xl z-50 w-[240px]"
                      style={{ 
                        backgroundColor: 'rgba(30, 30, 30, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}>
                      <DateRangePicker 
                        startDate={tempStartDate}
                        endDate={tempEndDate}
                        onStartDateChange={setTempStartDate}
                        onEndDateChange={setTempEndDate}
                        onClose={() => setShowDatePicker(false)}
                        onApplyFilter={applyFilter}
                        onClearFilter={clearFilter}
                      />
                  </div>
                  )}
                </div>
                
                {/* Monthly Usage Summary */}
                <div className="text-sm text-muted-foreground">
                  {isInitialLoading ? (
                    <div className="flex items-center space-x-2">
                      <span>This month's usage:</span>
                      <div className="h-4 w-16 bg-secondary/50 rounded animate-pulse"></div>
                      <span>tokens •</span>
                      <div className="h-4 w-12 bg-secondary/50 rounded animate-pulse"></div>
                    </div>
                  ) : (
                    <>This month's usage: <span className="font-medium text-foreground">{monthlyUsage.tokens.toLocaleString()}</span> tokens • <span className="font-medium text-foreground">${monthlyUsage.cost.toFixed(2)}</span></>
                  )}
            </div>
          </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : usageRecords.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Model</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Tokens</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full">
                      <tbody className="divide-y divide-white/10">
                        {usageRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-sm text-foreground">
                              {new Date(record.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {record.model}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-foreground">
                              {record.tokens.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-foreground">
                              ${record.cost.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
        </div>

                  {/* Load More Data Button */}
                  {hasMoreRecords && (
                    <div className="flex justify-center py-4 border-t border-white/10">
              <button 
                        onClick={fetchMoreRecords}
                        disabled={loadingMore}
                        className="px-4 py-2 text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        {loadingMore ? (
                          <>
                            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            Load More Data ({totalRecords - usageRecords.length} remaining)
                          </>
                        )}
              </button>
            </div>
                        )}
                      </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No usage records found</p>
                    </div>
              )}
                  </div>
                </div>
            </div>

          {/* Purchase History & Invoices */}
          <div className="luxury-card p-6 mt-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'rgba(30, 30, 30, 0.5)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 25px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}>
                  <DollarSign className="w-5 h-5 text-icon-color" />
            </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Purchase History</h2>
                  <p className="text-sm text-muted-foreground">View your invoices and purchase records</p>
          </div>
              </div>
              <button
                onClick={exportPurchasesCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  color: '#ffffff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';

                  // Trigger shimmer effect
                  const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                  if (shimmer) {
                    const existingTimeout = shimmerTimeoutsRef.current.get('exportInvoices');
                    if (existingTimeout) {
                      clearTimeout(existingTimeout);
                    }
                    
                    shimmer.style.transition = 'transform 0.5s ease-out';
                    shimmer.style.transform = 'translateX(100%)';
                    const timeout = setTimeout(() => {
                      shimmer.style.transition = 'none';
                      shimmer.style.transform = 'translateX(-100%)';
                      shimmerTimeoutsRef.current.delete('exportInvoices');
                    }, 500);
                    shimmerTimeoutsRef.current.set('exportInvoices', timeout);
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <div className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none" style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  transform: 'translateX(-100%)'
                }}></div>
                <Download className="w-4 h-4" />
                <span>Export .CSV</span>
              </button>
        </div>

            <div className="space-y-4">
              {isInitialLoading ? (
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Tokens</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full">
                      <tbody className="divide-y divide-white/10">
                        {[...Array(3)].map((_, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3">
                              <div className="h-4 w-20 bg-secondary/50 rounded animate-pulse"></div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-4 w-32 bg-secondary/50 rounded animate-pulse"></div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="h-4 w-16 bg-secondary/50 rounded animate-pulse ml-auto"></div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="h-4 w-12 bg-secondary/50 rounded animate-pulse ml-auto"></div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="h-6 w-16 bg-secondary/50 rounded-full animate-pulse mx-auto"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : recentPurchases.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Tokens</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full">
                      <tbody className="divide-y divide-white/10">
                        {recentPurchases.map((purchase) => (
                          <tr key={purchase.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-sm text-foreground">
                              {new Date(purchase.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {purchase.description}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-foreground">
                              {purchase.tokens ? purchase.tokens.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-foreground">
                              ${purchase.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                purchase.status === 'completed' 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : purchase.status === 'pending'
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {purchase.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Load More Purchases Button */}
                    {hasMorePurchases && (
                      <div className="flex justify-center py-4 border-t border-white/10">
                        <button 
                          onClick={fetchMorePurchases}
                          disabled={loadingMorePurchases}
                          className="px-4 py-2 text-sm font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          {loadingMorePurchases ? (
                            <>
                              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              Load More Purchases
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No purchase records found</p>
                </div>
              )}
                </div>
            </div>

        {/* Modals */}
        <BuyTokensDialog
          isOpen={showBuyTokens}
          onClose={() => setShowBuyTokens(false)}
          hasPaymentMethod={paymentMethods.length > 0}
          onSuccess={() => {
            // Refresh billing data to show updated token balance
            fetchInitialRecords()
          }}
        />
        {showPlanChange && <PlanChangeModal />}
        <PaymentMethodDialog
          isOpen={showAddPayment}
          onClose={() => setShowAddPayment(false)}
          onSuccess={() => {
            // Refresh payment methods and other billing data
            fetchInitialRecords()
          }}
        />

        {/* Delete Payment Method Confirmation Dialog */}
        {showDeleteConfirmation && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div 
              className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-center p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-foreground">Delete Payment Method</h2>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-muted-foreground mb-6">
                  Are you sure you want to delete this payment method? This action cannot be undone.
                </p>
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowDeleteConfirmation(false)
                      setPaymentMethodToDelete(null)
                    }}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeletePaymentMethod}
                    disabled={isDeleting}
                    className="relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-500 hover:scale-105 overflow-hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      transform: 'translateY(0)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isDeleting) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        
                        // Trigger shimmer effect
                        const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                        if (shimmer) {
                          shimmer.style.transition = 'transform 0.5s ease-out';
                          shimmer.style.transform = 'translateX(100%)';
                          setTimeout(() => {
                            shimmer.style.transition = 'none';
                            shimmer.style.transform = 'translateX(-100%)';
                          }, 500);
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDeleting) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                      }
                    }}
                  >
                    {/* Shimmer effect */}
                    <div 
                      className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.2), transparent)',
                        transform: 'translateX(-100%)'
                      }}
                    ></div>
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-t-transparent border-red-400 rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
    </DashboardLayout>
  )



  // Plan Change Modal
  function PlanChangeModal() {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl"
             style={{
               backgroundColor: 'rgba(30, 30, 30, 0.95)',
               backdropFilter: 'blur(20px)',
               border: '1px solid rgba(255, 255, 255, 0.1)',
               boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
             }}>
          <div className="flex items-center justify-center p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-foreground">Change Plan</h2>
                </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative p-6 rounded-xl border transition-all duration-300 ${
                    currentPlan?.id === plan.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="px-3 py-1 text-xs bg-primary text-white rounded-full">
                        Most Popular
                      </span>
              </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-foreground mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                      <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                    <p className="text-primary font-medium">{plan.tokens}</p>
            </div>
            
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3 text-muted-foreground">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePlanChange(plan.id)}
                    disabled={currentPlan?.id === plan.id}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      currentPlan?.id === plan.id
                        ? 'bg-white/10 text-muted-foreground cursor-not-allowed'
                        : 'bg-primary hover:bg-primary/80 text-white'
                    }`}
                  >
                    {currentPlan?.id === plan.id ? 'Current Plan' : 'Switch to ' + plan.name}
              </button>
            </div>
              ))}
          </div>
        </div>
      </div>
      </div>
  )
  }


} 