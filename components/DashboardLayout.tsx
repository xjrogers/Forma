'use client'

import { useState } from 'react'
import SideNavigation from './SideNavigation'

interface DashboardLayoutProps {
  children: React.ReactNode
  activeTab?: string
}

export default function DashboardLayout({ children, activeTab = 'builder' }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-40"
        style={{ backgroundImage: 'url(/dashboard-background.png)' }}
      ></div>
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <SideNavigation 
        activeTab={activeTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main content area */}
      <div className="lg:pl-16 relative z-10">
        {/* Main content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
} 