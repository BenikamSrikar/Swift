import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
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
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div className="prose-container space-y-10 text-foreground/90">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By accessing or using the SWIFT ("Secure Wideband Instant File Transfer") application (the "Service"), 
              you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may 
              not access the Service.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">2. Description of Service</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              SWIFT provides a web-based, peer-to-peer file transfer service utilizing WebRTC technology. 
              The Service facilitates direct connections between devices to transfer data without permanently 
              storing the file content on our servers. The Service requires a Google account for authentication.
            </p>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">3. Acceptable Use Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-2">
              <li>Transmit, distribute, or store any material that violates applicable local, state, national, or international law.</li>
              <li>Transfer illegal content, including but not limited to copyrighted materials without permission, malware, viruses, or explicit content prohibited by law.</li>
              <li>Engage in any activity that interferes with or disrupts the Service (or the servers and networks connected to the Service).</li>
              <li>Attempt to gain unauthorized access to any part of the Service, other users' accounts, or computer systems or networks connected to the Service.</li>
              <li>Use the Service for any malicious or harmful purposes.</li>
            </ul>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">4. User Responsibilities and Content</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Since SWIFT operates primarily as a peer-to-peer transfer tool, we do not monitor, review, or store the content 
              of the files you transfer. You are solely responsible for the files you send and receive using the Service. 
              We disclaim any liability relating to the content transmitted through our Service. You agree to bear all 
              risks associated with the transfer of any content, including reliance on its accuracy, completeness, or usefulness.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">5. Intellectual Property</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The Service and its original content, features, and functionality are owned by the creators of SWIFT 
              and are protected by international copyright, trademark, patent, trade secret, and other intellectual 
              property or proprietary rights laws.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">6. Termination</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may terminate or suspend your access to the Service immediately, without prior notice or liability, 
              for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, 
              your right to use the Service will immediately cease. You can also terminate your account at any time 
              by using the "Delete Account" feature within the application.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">7. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              In no event shall SWIFT, its developers, partners, or suppliers be liable for any indirect, incidental, 
              special, consequential or punitive damages, including without limitation, loss of profits, data, use, 
              goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access 
              or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content 
              obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, 
              whether based on warranty, contract, tort (including negligence) or any other legal theory.
            </p>
          </section>

          {/* Disclaimer */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">8. Disclaimer</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" 
              basis. The Service is provided without warranties of any kind, whether express or implied, including, 
              but not limited to, implied warranties of merchantability, fitness for a particular purpose, 
              non-infringement or course of performance.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">9. Changes to Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will 
              provide notice of any significant changes. By continuing to access or use our Service after those 
              revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">10. Contact Us</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If you have any questions about these Terms, please contact us by creating an issue on our GitHub 
              repository or emailing the project maintainer.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold text-primary">SWIFT</span>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/privacy')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
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
