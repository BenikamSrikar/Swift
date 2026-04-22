<div align="center">
  <img src="https://img.shields.io/badge/version-v1.5-blue.svg?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-Auth_%26_Signaling-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</div>

<br />

<div align="center">
  <h1>⚡ SWIFT-Connect</h1>
  <p><strong>Secure Wideband Instant File Transfer</strong> — The ultimate zero-storage, peer-to-peer file transfer platform built entirely on pure WebRTC. Bypass the cloud and transfer files directly from browser to browser.</p>
</div>

---

## 🌟 Inspiration
In a digital landscape dominated by proprietary file-sharing clouds enforcing hidden limits, throttled network speeds, and invasive data compliance tracking (e.g., Google Drive, Dropbox), SWIFT-Connect was conceived as an elegant, uncompromising alternative. 

Inspired by the fundamental principles of open P2P networks and "zero-knowledge" remote architectures, this project ensures **your actual files are never uploaded to a cloud database**. Supabase is effectively used merely as a temporary signaling and authentication bridge—once peers authenticate and connect via secure room negotiation, the transfer line is established natively *between them*.

## 🚀 Key Features & Capabilities
* **Zero-Storage P2P Transfer:** Unparalleled privacy and speed limit elimination. Your data is routed directly user-to-user utilizing local network WebRTC `RTCDataChannel` integrations.
* **Active Network Rooms:** Rapidly host and join securely gated network rooms by interacting with real-time active host lists directly on the connection dashboard. No manual codes needed.
* **Smart Folder Packaging:** Send multiple files or entire nested directories effortlessly. The internal application engine utilizes `JSZip` to process and tightly zip hierarchies on-the-fly before transmission.
* **Connection Dashboard:** Host administrators possess granular control over incoming live connections, with live connection queues, immediate kicking abilities, and dynamic room locking.
* **Premium UI Experience:** Features cutting-edge visual layouts. Powered by intricate glassmorphism elements, reactive particle backgrounds, flawless `framer-motion` layout animations, and premium minimalist `shadcn/ui` structural components.
* **Automated Transfer History:** Keeps lightweight, non-intrusive personal logging of all file exchanges tied strictly to user profiles.

## 💻 Technical Architecture & Dependencies
This project is robustly structured around a modern React ecosystem, lightning-fast compiled using Vite for hot module replacement (HMR), and completely typed with strict TypeScript configurations.

### Core Foundation
- **Frontend Framework:** React 18 + TypeScript + Vite
- **Backend & Real-Time Sync:** Supabase (OAuth protocols, PostgreSQL active schema listeners for presence & status events)
- **P2P Transfer Mechanism:** Built-in Browser WebRTC API (`RTCPeerConnection`, `RTCDataChannel`)
- **Routing Management:** React Router v6

### Theming, UI, & Aesthetics
- **Styling Systems:** TailwindCSS configured with vivid aesthetic color matrices and deeply customized tokens.
- **Component Primitives:** `shadcn/ui` (Implementation of Radix UI core headless structures)
- **Micro-Animations:** `framer-motion` paired with dynamic CSS keyframe handling.
- **Iconography:** `lucide-react`
- **Interactivity Add-ons:** `embla-carousel-react`, `sonner` (For toast events), `@radix-ui/react-dialog`

### File Handling Utils
- **Client-Side Compression:** `jszip` (Crucial for live local folder combinations)
- **Form Verification:** `zod` alongside `react-hook-form`
- **Timestamp Handling:** `date-fns`
- **Linting & Testing:** Managed through strict ESLint configurations, Vitest, and Playwright execution environments.

## 🛠️ Local Development & Setup

### Prerequisites
You need **Node.js 18+** operating on your machine and a local or cloud-hosted **Supabase Instance**.

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/BenikamSrikar/Swift.git
   cd Swift
   ```

2. **Install Depedencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Construct a `.env` (or `.env.local`) configuration passing your active Supabase endpoints:
   ```env
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   
4. **Synchronize Supabase:**
   Apply any stored SQL migrations to ensure tables `profiles`, `sessions`, `rooms`, `room_participants`, and `transfer_history` map successfully to your schema.

5. **Initialize Project Build:**
   ```bash
   npm run dev
   ```
   Access the local client securely on `http://localhost:8080`.

## 🤝 Contributing
Contributions are critical to ensuring the open-source community maintains exceptional standards. Should you choose to improve this file transferring module, your insights and code are **greatly appreciated**! Fork the repo, draft a feature branch, and hit us with a structural Pull Request. 

## 📜 License
Distributed securely under the MIT open-source License. See `LICENSE` for extended operational information.

<br />

---
> *If SWIFT-Connect revolutionized your real-time local file-sharing or assisted you in learning intricate WebRTC P2P engineering concepts, drop a ⭐️ on the repository!*
