# Code signing policy

Status: NOT ENROLLED. The project has not been approved by SignPath Foundation and no signing certificate or production signing token is configured.

Proposed route: apply for free open-source code signing after the repository is public, maintained, documented and demonstrably controlled by its owner. Approval is discretionary; a newly published executable project may not meet the Foundation's reputation requirement.

Maintainer, reviewer and signing approver: the EAGLE RS project owner. Connected project-owner account: https://github.com/helpbringer9485-hash . Other team members must be recorded here if added. Require MFA and manual approval of every release signing request. Do not insert a fake owner handle or claim provider approval.

Build binaries from the reviewed source in the recorded CI workflow. Sign only authorized project artifacts. Preserve upstream licenses and signatures. Protect signing credentials as repository secrets; never place them in source or chat. Enforce product and version metadata for signed executables. Do not publish experimental unsigned output as a Windows-trusted release.

If approved, update this policy with the required provider attribution and configure the approved SignPath project, artifact and signing policies. Do not claim free code signing is provided before approval.

Provider requirements: https://signpath.org/terms.html
Application: https://signpath.org/apply.html
