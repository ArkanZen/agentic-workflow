## ADDED Requirements

### Requirement: Project discovery
The system SHALL discover local projects that have agentic-workflow installed or partially configured, within explicit scan roots.

#### Scenario: Installed project found by manifest
- **WHEN** a scanned directory contains `.agentic-workflow/manifest.json`
- **THEN** the dashboard lists the directory as an installed workflow project with manifest-derived version, tier, hosts, and source repository data

#### Scenario: Partially configured project found by config marker
- **WHEN** a scanned directory contains `openspec/config.yaml` with an `agentic-workflow-version` marker but no manifest
- **THEN** the dashboard lists the directory as a partially configured workflow project and marks the manifest as missing

#### Scenario: Directory outside scan roots ignored
- **WHEN** a project exists outside the configured scan roots
- **THEN** the dashboard does not scan or display that project

#### Scenario: Scan roots configurable by user
- **WHEN** the user adds or removes a scan root in the dashboard
- **THEN** the next scan uses the user-configured roots instead of a hardcoded local workspace path

### Requirement: Project health summary
The system SHALL summarize each discovered project's workflow health from existing files and validation commands.

#### Scenario: Health status shown after doctor
- **WHEN** the user runs doctor for a project
- **THEN** the dashboard shows pass, warning, and failure counts plus the raw doctor output

#### Scenario: Tool capability status grouped by tool
- **WHEN** the dashboard loads a project
- **THEN** it groups capabilities by `OpenSpec`, `GStack`, and `Superpowers`, with English tool names as titles and Chinese descriptions as subtitles

#### Scenario: Capability state and details are distinct
- **WHEN** a capability is displayed
- **THEN** availability is shown as non-clickable state text while version, install path, or detection detail is shown separately

#### Scenario: AI host support matrix shown per tool
- **WHEN** a tool capability is displayed
- **THEN** the dashboard shows how `Codex App` and `Claude CLI` support that tool, including install status, support scope, version, or install path

#### Scenario: Version and update guidance shown
- **WHEN** a capability supports version detection
- **THEN** the dashboard shows current version, latest version or marketplace check guidance, and a host-appropriate update action or manual update instruction

#### Scenario: Workflow capability definitions are visible
- **WHEN** a workflow capability is displayed
- **THEN** the dashboard shows whether the installed workflow defines it and lists the related commands or skills when defined

#### Scenario: Official and workflow-used skills are separated
- **WHEN** a tool has official skills or commands
- **THEN** the dashboard separates official tool definitions, skills used by agentic-workflow, and unused available skills with short purpose descriptions

#### Scenario: Workflow explanations are collapsible
- **WHEN** workflow definitions are displayed
- **THEN** official workflow explanations and project-specific explanations are available in a collapsed section by default

### Requirement: OpenSpec statistics
The system SHALL show OpenSpec workflow statistics for discovered projects when OpenSpec data is available.

#### Scenario: Active changes summarized
- **WHEN** `openspec list --json` succeeds for a project
- **THEN** the dashboard shows active change count, completed task count, total task count, and latest modification time

#### Scenario: OpenSpec unavailable
- **WHEN** `openspec list --json` fails for a project
- **THEN** the dashboard shows an unavailable state without blocking other project metadata

### Requirement: Controlled workflow actions
The system SHALL allow only predefined workflow maintenance actions against discovered projects.

#### Scenario: Upgrade action uses install script
- **WHEN** the user confirms workflow update for a project
- **THEN** the system runs the repository `install.sh` with `--upgrade`, `--no-interactive`, the selected project path, and the project's current tier

#### Scenario: Switch tier action uses install script
- **WHEN** the user confirms a workflow tier switch
- **THEN** the system runs the repository `install.sh` with `--switch`, `--no-interactive`, the selected project path, and the requested tier

#### Scenario: Gitignore action updates workflow document ignores
- **WHEN** the user confirms adding workflow documents to `.gitignore`
- **THEN** the system writes an idempotent controlled block for workflow document and host configuration paths into the selected project's `.gitignore`

#### Scenario: Tool update action uses host-specific command
- **WHEN** the user confirms a supported tool update
- **THEN** the system runs only the predefined update command for that tool and host

#### Scenario: Arbitrary shell input rejected
- **WHEN** a request attempts to run an action outside the predefined maintenance actions
- **THEN** the API rejects the request and does not execute a shell command

### Requirement: Geek style dashboard UI
The system SHALL provide a dark, dense, terminal-inspired dashboard interface suitable for scanning multiple local project states.

#### Scenario: Project list comparison
- **WHEN** multiple projects are discovered
- **THEN** the UI presents them in a compact comparison view with status indicators for tier, version, hosts, health, and capabilities

#### Scenario: Project detail inspection
- **WHEN** the user selects a project
- **THEN** the UI presents project metadata, OpenSpec statistics, doctor results, and available workflow actions without navigating away from the dashboard context

#### Scenario: Menu navigation keeps content focused
- **WHEN** the user switches between overview, tools, workflows, health, and settings
- **THEN** the dashboard shows only the selected functional area while preserving the selected project context
