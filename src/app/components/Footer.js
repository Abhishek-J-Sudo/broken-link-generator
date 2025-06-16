// src/app/components/Footer.js
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-indigo-900 border-t border-indigo-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-indigo-300 mb-4 md:mb-0">Built with Next.js</div>
          <div className="text-sm text-indigo-300 mb-4 md:mb-0">
            @2025 Abhishek Jagtap | Made with Claude.ai
          </div>
          <div className="flex space-x-6">
            <Link href="/analyze" className="text-sm text-indigo-300 hover:text-white">
              Smart Analyzer
            </Link>
            <a
              href="https://github.com/yourusername/broken-link-checker"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-300 hover:text-white"
            >
              GitHub
            </a>
            <a href="#" className="text-sm text-indigo-300 hover:text-white">
              Documentation
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
