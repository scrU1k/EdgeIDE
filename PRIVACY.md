# Privacy Policy

Last updated: October 2026

This Privacy Policy describes how EdgeIDE ("the Application") operates, how device resources and platform permissions are handled, and how user privacy is safeguarded. EdgeIDE is an open-source project published under the terms of the GNU General Public License version 3 (GPL v3).

---

## 1. Core Architecture and Philosophy

EdgeIDE is designed as an offline-first, privacy-oriented development environment. Code execution, virtual filesystem management, and editor tooling run directly on the user's client hardware.

The application operates under the following core principles:
- No tracking pixels, analytics SDKs, user telemetry, or advertising frameworks are embedded in the software.
- No personal user information, account profiles, or identities are collected, monetized, or shared.
- Workspace source code and files remain exclusively on the user's device unless the user explicitly initiates an external connection or peer transfer.

---

## 2. Local Data Storage, Retention, and Deletion

All application data is retained locally on the host device:
- **Project Files and Source Code:** Workspace files are persisted within browser IndexedDB databases and synchronized with native storage directories (such as `Documents/EdgeIDE` on mobile platforms).
- **Application Preferences:** User settings, themes, keybindings, and editor configurations are saved locally via IndexedDB and `localStorage`.
- **Runtime Execution:** Code execution (including JavaScript Web Workers and Pyodide WebAssembly environments) operates within the local sandboxed environment of the user's device. No user code is dispatched to remote servers for compilation or evaluation.
- **Data Deletion:** Because all data is stored locally, users maintain full control over data deletion. Removing all project files, cached states, and configurations can be performed at any time by:
  - Deleting project folders from `Documents/EdgeIDE` using any file manager;
  - Clearing application site data or cache through browser or device settings; or
  - Uninstalling the application from the device.
  No remote copies, backups, or account residues exist on any centralized project infrastructure.

---

## 3. Platform Permissions (Android)

On mobile platforms such as Android, the application requests strictly scoped system permissions necessary to support core editing and connectivity functions:

### Storage Access
- **Permissions:** `android.permission.READ_EXTERNAL_STORAGE` and `android.permission.WRITE_EXTERNAL_STORAGE` (on Android 12 and below). On Android 13+ (API level 33 and higher), access operates via Scoped Storage targeting public document directories (`Directory.Documents`).
- **Purpose:** Used exclusively to read user project files and save workspace modifications directly into `Documents/EdgeIDE` or directories explicitly chosen via the system file picker.
- **Scope:** The application does not index, collect, or read files outside the designated workspace directories or explicitly selected files.

### Camera Access
- **Permission:** `android.permission.CAMERA`
- **Purpose:** Used solely for optical real-time detection when scanning QR codes to establish peer-to-peer (P2P) WebRTC communication.
- **Scope:** Camera video frames are analyzed in temporary memory solely for QR pattern recognition. No photographs, video streams, or biometric data are recorded, stored to disk, or transmitted over any network.

### Network Access
- **Permission:** `android.permission.INTERNET`
- **Purpose:** Used to facilitate local Wi-Fi / hotspot / direct relay peer synchronization, load Pyodide WebAssembly binaries and dependencies from trusted CDNs on initial download, and install packages when requested via `pip`. Network access can be toggled off at any time using the in-app "Net: Off" toggle button in the output panel toolbar, instantly severing external connections.

---

## 4. Peer-to-Peer (P2P) Workspace Sharing and End-to-End Encryption

EdgeIDE includes optional, zero-cloud peer-to-peer workspace sharing and synchronization features designed to operate with zero telemetry and without central database tracking:
- **Local Wi-Fi and Temporary Portable Hotspot Bridging:** Devices can communicate entirely over a local Wi-Fi network or a temporary portable Wi-Fi hotspot established directly between two devices without internet connectivity. Under local network or hotspot operation, all packets travel strictly between the two devices across the local subnet; no external servers, signaling intermediaries, or relays are contacted.
- **Air-Gapped Optical QR Transfer:** Devices may initiate transfers or exchange credentials optically via QR code scanning using the camera, enabling completely offline, zero-network discovery and credential handshake.
- **End-to-End Encryption (E2EE):** All direct messages, envelopes, and file transfer payloads are encrypted end-to-end using Elliptic Curve Diffie-Hellman (ECDH P-256) key agreement and AES-GCM 256-bit authenticated encryption with a unique 12-byte initialization vector (IV) per message. Key pinning is enforced to reject key substitutions. Even in transit over intermediate relays or public signaling topics, contents cannot be read or modified by third parties or eavesdroppers. Unencrypted targeted transmission is strictly blocked.
- **Public Relay Fallback & Isolation Control:** If devices are on different networks, optional internet signaling fallback (MQTT over WebSocket via HiveMQ) is used strictly for encrypted signaling negotiation. When "Net: Off" is enabled in the application, this external relay is completely disabled and disconnected, enforcing strict local subnet / hotspot isolation.
- **Peer IP Disclosure:** As an inherent aspect of direct local IP networking (Wi-Fi or hotspot), participating devices on the same subnet communicate directly using local private IP addresses.

---

## 5. Third-Party Content Delivery Networks (CDNs)

When online network access is enabled ("Net: On"), the application may communicate with the following third-party hosts on initial use:
- **`cdn.jsdelivr.net`:** Distributes Pyodide WebAssembly binaries, standard pre-compiled scientific wheels (such as NumPy, Matplotlib, SciPy, Pandas), KaTeX mathematics stylesheets, and Mermaid diagram renderers. The application also supports offline loading from bundled local assets (`/pyodide/`) when bundled with the build.
- **`pypi.org` and `files.pythonhosted.org`:** Queried when installing pure-Python packages via the integrated terminal (`pip install <package>`).

When fetching assets from these hosts, the user's IP address and standard HTTP request headers are received by those third-party providers subject to their respective privacy terms and CDN caching policies. Users desiring complete network isolation can utilize the in-app "Net: Off" control in the panel toolbar to block sandbox outbound requests entirely.

---

## 6. Open Source Transparency and Source Inspection

The complete source code of EdgeIDE is openly accessible under the GNU General Public License version 3 (GPL v3). Users, developers, and independent security researchers may inspect the implementation, verify the absence of tracking or telemetry, build the project from source, and confirm adherence to this Privacy Policy.

---

## 7. Disclaimer of Liability

The application is provided under the terms of the GPL v3 license without warranties. The author and contributors assume no liability or responsibility for:
- Loss, alteration, or corruption of local project files or device storage;
- Security incidents, unauthorized access, or interceptions occurring on networks the user connects through; or
- Any scripts, commands, dependencies, or programs executed by the user using the software.

---

## 8. Contact Information

For inquiries regarding this Privacy Policy, technical audits, or issue reporting, please visit the project repository:
- **Repository Issues:** [https://github.com/](https://github.com/) (EdgeIDE Project Repository)
- **Project License:** See [LICENSE](file:///C:/Users/niger/Desktop/Antigrav%20projects/EdgeIDE/LICENSE)

---

## 9. Updates to this Policy

If updates are made to the software that alter permission requirements, external host interactions, or privacy handling, this document will be updated in the repository. Continued use of EdgeIDE following updates reflects acknowledgment of the revised policy.
