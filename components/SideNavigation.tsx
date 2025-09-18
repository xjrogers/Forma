'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  X,
  HelpCircle,
  LogOut,
  Settings,
  CreditCard,
  Plus,
  Home
} from 'lucide-react'
import Link from 'next/link'
import { authService } from '@/lib/auth'

interface SideNavigationProps {
  activeTab?: string
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export default function SideNavigation({ activeTab = 'builder', sidebarOpen, setSidebarOpen }: SideNavigationProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setUser(authService.getCurrentUser())
  }, [])

  const handleLogout = async () => {
    await authService.logout()
    window.location.href = '/login'
  }

  const handleMouseEnter = () => {
    setIsExpanded(true)
  }

  const handleMouseLeave = () => {
    setIsExpanded(false)
  }

  const handleNavigationClick = () => {
    // Close sidebar on mobile immediately after navigation
    if (window.innerWidth < 1024) { // lg breakpoint
      setSidebarOpen(false)
    }
  }
  
  const navigation = [
    { name: 'Home', href: '/', icon: Home, id: 'home' },
    { name: 'Projects', href: '/dashboard/projects', icon: FileText, id: 'projects' }
  ]

  const bottomNavigation = [
    { name: 'Billing & Usage', href: '/dashboard/billing', icon: CreditCard, id: 'billing' },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, id: 'settings' }
  ]

  return (
    <div 
      data-sidebar
      className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-500 ease-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 group ${isExpanded ? 'w-48' : 'w-11'}`} 
      style={{
        backgroundColor: 'rgba(30, 30, 30, 0.5)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: isExpanded 
          ? '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
          : '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-2 h-16" style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Link href="/" className="flex items-center justify-center w-full h-full">
            <div className={`rounded-xl flex items-center justify-center flex-shrink-0 relative transition-all duration-500 hover:scale-110 ${
              isExpanded ? 'w-12 h-12' : 'w-7 h-7'
            }`} style={{
              background: 'rgba(30, 30, 30, 0.5)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 25px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}>
              <img 
                src="/logo.png" 
                alt="Forma Logo" 
                className="w-full h-full object-contain transition-all duration-300 hover:drop-shadow-lg"
              />
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`p-2 text-muted-foreground hover:text-foreground transition-all duration-300 lg:hidden ${
              isExpanded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 pt-8 flex flex-col">
          {/* Main Navigation */}
          <ul className="space-y-1 mb-auto">
            {navigation.map((item) => {
              const isActive = activeTab === item.id
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={handleNavigationClick}
                    className={`flex items-center rounded-xl font-medium transition-all duration-500 relative group/item overflow-hidden ${
                      isExpanded ? 'px-3 py-2 space-x-2' : 'p-2 justify-center'
                    }`}
                    style={{
                      background: isActive 
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                        : 'transparent',
                      border: isActive 
                        ? '1px solid rgba(255, 255, 255, 0.2)'
                        : '1px solid transparent',
                      boxShadow: isActive 
                        ? '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : 'none',
                      color: isActive ? '#ffffff' : undefined,
                      transform: 'translateY(0)',
                      backdropFilter: isActive ? 'blur(20px)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (isActive) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                        
                        // Trigger shimmer effect for active buttons
                        const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                        if (shimmer) {
                          shimmer.style.transform = 'translateX(100%)';
                          setTimeout(() => {
                            shimmer.style.transform = 'translateX(-100%)';
                          }, 500);
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isActive) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Shimmer effect for active buttons */}
                    {isActive && (
                      <div 
                        className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                          transform: 'translateX(-100%)',
                          transition: 'transform 0.5s'
                        }}
                      ></div>
                    )}
                    <item.icon className={`w-4 h-4 flex-shrink-0 relative z-10 transition-all duration-300 ${
                      isActive ? 'text-white' : 'text-muted-foreground group-hover/item:text-foreground'
                    }`} />
                    <span className={`transition-all duration-500 relative z-10 font-medium text-sm whitespace-nowrap ${
                      isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                    } ${isExpanded ? 'block' : 'hidden'} ${
                      isActive ? 'text-white' : 'text-muted-foreground group-hover/item:text-foreground'
                    }`}>
                      {item.name}
                    </span>
                    
                    {/* Tooltip for collapsed state */}
                    {!isExpanded && (
                      <div className="absolute left-11 rounded-lg px-3 py-1 text-xs text-foreground opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all duration-300 whitespace-nowrap z-50" style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                        transform: 'translateY(-50%)',
                        top: '50%'
                      }}>
                        {item.name}
                        <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 rotate-45" style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%)',
                          borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                          borderTop: '1px solid rgba(255, 255, 255, 0.15)'
                        }}></div>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Bottom Navigation */}
          <ul className="space-y-1 mb-4">
            {bottomNavigation.map((item) => {
              const isActive = activeTab === item.id
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={handleNavigationClick}
                    className={`flex items-center rounded-xl font-medium transition-all duration-500 relative group/item overflow-hidden ${
                      isExpanded ? 'px-3 py-2 space-x-2' : 'p-2 justify-center'
                    }`}
                    style={{
                      background: isActive 
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                        : 'transparent',
                      border: isActive 
                        ? '1px solid rgba(255, 255, 255, 0.2)'
                        : '1px solid transparent',
                      boxShadow: isActive 
                        ? '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : 'none',
                      color: isActive ? '#ffffff' : undefined,
                      transform: 'translateY(0)',
                      backdropFilter: isActive ? 'blur(20px)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (isActive) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                        
                        // Trigger shimmer effect for active buttons
                        const shimmer = e.currentTarget.querySelector('.shimmer-effect') as HTMLElement;
                        if (shimmer) {
                          shimmer.style.transform = 'translateX(100%)';
                          setTimeout(() => {
                            shimmer.style.transform = 'translateX(-100%)';
                          }, 500);
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isActive) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Shimmer effect for active buttons */}
                    {isActive && (
                      <div 
                        className="shimmer-effect absolute top-0 left-0 w-full h-full pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                          transform: 'translateX(-100%)',
                          transition: 'transform 0.5s'
                        }}
                      ></div>
                    )}
                    <item.icon className={`w-4 h-4 flex-shrink-0 relative z-10 transition-all duration-300 ${
                      isActive ? 'text-white' : 'text-muted-foreground group-hover/item:text-foreground'
                    }`} />
                    <span className={`transition-all duration-500 relative z-10 font-medium text-sm whitespace-nowrap ${
                      isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                    } ${isExpanded ? 'block' : 'hidden'} ${
                      isActive ? 'text-white' : 'text-muted-foreground group-hover/item:text-foreground'
                    }`}>
                      {item.name}
                    </span>
                    
                    {/* Tooltip for collapsed state */}
                    {!isExpanded && (
                      <div className="absolute left-11 rounded-lg px-3 py-1 text-xs text-foreground opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all duration-300 whitespace-nowrap z-50" style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                        transform: 'translateY(-50%)',
                        top: '50%'
                      }}>
                        {item.name}
                        <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 rotate-45" style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%)',
                          borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                          borderTop: '1px solid rgba(255, 255, 255, 0.15)'
                        }}></div>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer - Sign Out */}
        <div className="p-2" style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <ul className="space-y-1">
            <li>
              <button 
                onClick={handleLogout}
                className={`flex items-center rounded-xl font-medium transition-all duration-500 relative group/item overflow-hidden w-full ${
                  isExpanded ? 'px-3 py-2 space-x-2' : 'p-2 justify-center'
                }`}
                style={{
                  background: 'transparent',
                  border: '1px solid transparent'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"></div>
                <LogOut className={`w-4 h-4 flex-shrink-0 relative z-10 transition-all duration-300 text-muted-foreground group-hover/item:text-foreground`} />
                <span className={`transition-all duration-500 relative z-10 font-medium text-sm whitespace-nowrap ${
                  isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                } ${isExpanded ? 'block' : 'hidden'} text-muted-foreground group-hover/item:text-foreground`}>
                  Sign out
                </span>
                
                {/* Tooltip for collapsed state */}
                {!isExpanded && (
                  <div className="absolute left-11 rounded-lg px-3 py-1 text-xs text-foreground opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all duration-300 whitespace-nowrap z-50" style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                    transform: 'translateY(-50%)',
                    top: '50%'
                  }}>
                    Sign out
                    <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 rotate-45" style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%)',
                      borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                      borderTop: '1px solid rgba(255, 255, 255, 0.15)'
                    }}></div>
                  </div>
                )}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
} 