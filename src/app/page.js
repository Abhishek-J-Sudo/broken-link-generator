// src/app/page.js - Simplified & Clean Homepage
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LargeCrawlForm from '@/app/components/LargeCrawlForm';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SecurityNotice from '@/app/components/SecurityNotice';
import LegalTerms from './components/LegalTerms';
import HomeHeroSection from './components/HomeHeroSection';
import HomeSidebar from './components/HomeSidebar';
import HomeFeaturesSection from './components/HomeFeaturesSection';

export default function HomePage() {
  const [recentJobs, setRecentJobs] = useState([]);

  const handleJobStarted = (jobResult) => {
    console.log('New job started:', jobResult);
    // Could add the new job to recent jobs list in the future
  };

  // In your homepage component, add this useEffect:
  useEffect(() => {
    if (window.location.hash === '#crawler-form') {
      const formSection = document.getElementById('crawler-form');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <Header />

      {/* Hero Section */}
      <HomeHeroSection />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-3">
            <div id="crawler-form" className="bg-white rounded-lg shadow-lg p-6 mb-0">
              <LargeCrawlForm onJobStarted={handleJobStarted} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <HomeSidebar />
          </div>
        </div>
      </div>

      {/* Feature Comparison */}
      <HomeFeaturesSection />
      {/* Legal terms */}
      <LegalTerms variant="banner" />
      {/* Footer */}
      <Footer />
    </div>
  );
}
