# Terms of Service

Last updated: October 2026

Please read these Terms of Service ("Terms") carefully before using EdgeIDE ("the Application"). Access to and use of EdgeIDE is subject to compliance with these Terms and the governing open-source license.

---

## 1. Open Source Licensing and Acceptance

EdgeIDE is free and open-source software distributed under the terms of the **GNU General Public License version 3 (GPL v3)**.

In accordance with Section 9 of the GPL v3, users are not required to accept the license merely to run the Application. Your rights to run, study, modify, and redistribute the Application are governed comprehensively by the GPL v3 license. A copy of the license is included with the project source distribution (see [LICENSE](file:///C:/Users/niger/Desktop/Antigrav%20projects/EdgeIDE/LICENSE)).

General interaction with project distribution channels, repository services, and community resources is subject to these project Terms.

---

## 2. Nature and Operation of the Application

EdgeIDE is designed as an edge-oriented, client-side integrated development environment (IDE). The application provides:
- In-browser and on-device syntax highlighting, code editing, and notebook evaluation.
- Local virtual filesystem (VFS) management integrated with native filesystem storage and IndexedDB caches.
- Client-side code execution utilizing sandboxed Web Workers and WebAssembly runtimes (including Pyodide).
- Direct peer-to-peer workspace sharing capabilities negotiated via WebRTC.

The software operates primarily offline and executes code locally within the host runtime environment of the user's client hardware.

---

## 3. User Responsibilities and Ethical Scope

The user acknowledges and agrees that:
- **Sole Responsibility for Authored Code:** The application serves as a general-purpose programming tool. The user maintains sole and exclusive responsibility for all source code, scripts, configurations, commands, dependencies, or data authored, evaluated, imported, or executed within the application.
- **Legal Compliance:** The user is independently responsible for ensuring that all software authored, tested, or deployed via EdgeIDE complies with applicable local, state, national, and international laws, regulations, and third-party intellectual property rights.
- **Project Scope and Non-Endorsement:** EdgeIDE is designed strictly as a developer productivity and educational tool. The project is not designed for, and does not endorse, encourage, or facilitate, the creation, testing, or distribution of malware, exploit payloads, unauthorized network access tools, or destructive software.

---

## 4. Data Backups and Storage Management

EdgeIDE coordinates workspace synchronization across browser storage (IndexedDB) and local device file paths (such as `Documents/EdgeIDE`). Because client storage is subject to device state, browser cache eviction policies, hardware failures, and user actions:

- The user maintains sole responsibility for maintaining external backups, version control repositories, and redundant copies of all work.
- Neither the application, its author, nor its contributors guarantee permanent preservation or recovery of corrupted, deleted, or overwritten local files.

---

## 5. Disclaimer of Warranties

IN ACCORDANCE WITH SECTIONS 15 AND 16 OF THE GNU GENERAL PUBLIC LICENSE V3:

THE APPLICATION IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

THE ENTIRE RISK AS TO THE QUALITY, PERFORMANCE, ACCURACY, AND OUTCOME OF USING THE APPLICATION RESTS ENTIRELY WITH THE USER. SHOULD THE PROGRAM PROVE DEFECTIVE OR UNFIT FOR A SPECIFIC PURPOSE, THE USER ASSUMES THE COST OF ALL NECESSARY SERVICING, REPAIR, OR CORRECTION.

---

## 6. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW:

IN NO EVENT SHALL THE AUTHOR, COPYRIGHT HOLDERS, MAINTAINERS, OR CONTRIBUTORS BE LIABLE TO ANY USER OR THIRD PARTY FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE, ITS USE, OR OTHER DEALINGS IN THE SOFTWARE.

THIS EXCLUSION INCLUDES, WITHOUT LIMITATION:
- DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES;
- LOSS OF DATA, FILE CORRUPTION, LOSS OF REVENUE, LOSS OF PROFITS, OR BUSINESS INTERRUPTION;
- SYSTEM CRASHES, HARDWARE INSTABILITY, HIGH RESOURCE USAGE, OR PERFORMANCE DEGRADATION RESULTING FROM CODE EXECUTION OR WORKER PROCESSES; OR
- ANY DISPUTES, CLAIMS, OR INJURIES ARISING OUT OF SCRIPTS OR PROGRAMS CREATED OR RUN BY THE USER.

---

## 7. Third-Party Dependencies and External Tooling

The application incorporates and interfaces with external open-source libraries, runtimes, and parsers (including CodeMirror, Pyodide, Capacitor, isomorphic-git, xterm.js, and related packages). Each component remains governed by its respective upstream open-source license. The author makes no representations, endorsements, or warranties regarding third-party packages or external CDN availability.

---

## 8. Severability

If any provision of these Terms is held to be invalid, illegal, or unenforceable under applicable law, that provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable, or severed if modification is not possible. Such determination shall not affect the validity, legality, or enforceability of the remaining provisions of these Terms.

---

## 9. Modifications and Repository Information

The project repository may periodically update these Terms to reflect architectural improvements, license clarifications, or regulatory updates. Updated versions will be published directly within the source repository.
