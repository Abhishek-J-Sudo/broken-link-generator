'use client';

import Changelog from '../components/Changelog';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Changelog />
      <Footer />
    </div>
  );
}
