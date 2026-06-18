import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SWIFT
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <div className="mb-12">
          <span className="inline-block text-xs font-black uppercase tracking-[0.3em] text-primary/60 mb-3">
            Legal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div className="prose-container space-y-10 text-foreground/90">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">1. Introduction</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              SWIFT ("Secure Wideband Instant File Transfer") is a peer-to-peer file transfer web application. 
              This Privacy Policy explains how we collect, use, and protect your information when you use SWIFT 
              (the "Service"). We are committed to protecting your privacy and being transparent about our data practices.
            </p>
          </section>

          {/* What We Collect */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">2. Information We Collect</h2>
            
            <h3 className="text-base font-semibold mb-2 text-foreground/90">2.1 Information from Google Sign-In</h3>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              When you sign in with Google, we receive and store the following information from your Google account:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2">
              <li><strong className="text-foreground/80">Name</strong> — displayed to other users in transfer rooms so they can identify you</li>
              <li><strong className="text-foreground/80">Email address</strong> — used as a unique identifier for your account and displayed in your profile</li>
              <li><strong className="text-foreground/80">Profile picture</strong> — displayed alongside your name in transfer rooms</li>
            </ul>

            <h3 className="text-base font-semibold mb-2 mt-6 text-foreground/90">2.2 Information We Do NOT Collect</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2">
              <li>We do <strong className="text-foreground/80">not</strong> access your Google Drive, contacts, calendar, or any other Google services</li>
              <li>We do <strong className="text-foreground/80">not</strong> collect, store, or process the content of files you transfer</li>
              <li>We do <strong className="text-foreground/80">not</strong> log file names, file sizes, or transfer metadata</li>
              <li>We do <strong className="text-foreground/80">not</strong> use cookies for advertising or tracking purposes</li>
              <li>We do <strong className="text-foreground/80">not</strong> sell, share, or monetize your personal data in any way</li>
            </ul>
          </section>

          {/* How Files Are Transferred */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">3. How File Transfers Work</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              SWIFT uses <strong className="text-foreground/80">WebRTC (Web Real-Time Communication)</strong> to establish 
              direct peer-to-peer connections between devices. This means:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2">
              <li>Files travel <strong className="text-foreground/80">directly</strong> from the sender's device to the receiver's device</li>
              <li>Files are <strong className="text-foreground/80">never uploaded to or stored on</strong> our servers</li>
              <li>WebRTC data channels use <strong className="text-foreground/80">DTLS encryption</strong> for all data in transit</li>
              <li>Our servers only facilitate the initial connection handshake (signaling) between peers</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground mt-3">
              For very large files, SWIFT may temporarily use Supabase Storage as a relay when a direct peer-to-peer 
              connection cannot be established. In these cases, file chunks are encrypted, uploaded temporarily, 
              and deleted immediately after the recipient downloads them.
            </p>
          </section>

          {/* Data Storage */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">4. Data Storage</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              We use <strong className="text-foreground/80">Supabase</strong> (a cloud database service) to store:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2">
              <li><strong className="text-foreground/80">User profiles</strong> — your name, email, and profile picture URL from Google</li>
              <li><strong className="text-foreground/80">Room data</strong> — temporary room IDs and participant lists for active transfer sessions</li>
              <li><strong className="text-foreground/80">Transfer history</strong> — a log of file names and recipient names for your reference (visible only to you)</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground mt-3">
              Room data is ephemeral and is cleaned up when sessions end. Transfer history is associated with 
              your account and can be deleted at any time.
            </p>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">5. Data Sharing</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We do not sell, rent, or share your personal information with third parties for marketing purposes. 
              Your information is shared only in the following limited circumstances:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2 mt-3">
              <li><strong className="text-foreground/80">With other room participants</strong> — your name and profile picture are visible to users in the same transfer room</li>
              <li><strong className="text-foreground/80">Service providers</strong> — we use Supabase for authentication and data storage, and Vercel for hosting</li>
              <li><strong className="text-foreground/80">Legal requirements</strong> — if required by law or to protect our rights</li>
            </ul>
          </section>

          {/* Account Deletion */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">6. Account Deletion</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You can delete your account at any time from the SWIFT landing page. When you delete your account:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2 mt-3">
              <li>Your profile (name, email, avatar) is permanently removed</li>
              <li>All your active rooms and sessions are deleted</li>
              <li>Your room participation records are removed</li>
              <li>This action is immediate and irreversible</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">7. Children's Privacy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              SWIFT is not intended for use by children under the age of 13. We do not knowingly collect 
              personal information from children under 13. If you believe we have collected information 
              from a child under 13, please contact us and we will promptly delete it.
            </p>
          </section>

          {/* Security */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">8. Security</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We implement appropriate technical measures to protect your data, including:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2 mt-3">
              <li>HTTPS encryption for all web traffic</li>
              <li>DTLS encryption for WebRTC data channels</li>
              <li>Row Level Security (RLS) policies on our database</li>
              <li>OAuth 2.0 for authentication (no passwords stored)</li>
            </ul>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">9. Changes to This Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
              the new policy on this page and updating the "Last updated" date. Your continued use of the Service 
              after changes are posted constitutes your acceptance of the revised policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">10. Contact Us</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If you have any questions about this Privacy Policy or our data practices, please contact us 
              by creating an issue on our GitHub repository or emailing the project maintainer.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold text-primary">SWIFT</span>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/terms')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </button>
            <span className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} SWIFT. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
